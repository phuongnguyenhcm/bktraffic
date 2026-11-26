import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InternalEdge, InternalNode, LatLon } from '../../common/domain/traffic.models.js';
import { isLatLon, isLatLonArray } from '../../common/config/target-config.js';
import { resolveDataPath } from '../../common/data/data-files.js';
import { AbstractGeometryProvider } from './geometry.provider.abstract.js';

interface CacheEntry {
  edgeId: string;
  polyline: LatLon[];
  fetchedAt: string;
}

interface CacheFile {
  version: 1;
  entries: Record<string, CacheEntry>;
}

/** Sau khi OSRM lỗi, không thử lại cùng cạnh trong khoảng này (tránh dồn request khi offline) */
const RETRY_AFTER_FAILURE_MS = 60_000;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Trích `routes[0].geometry.coordinates` ([lon, lat][]) từ response OSRM một cách an toàn */
export function extractOsrmCoordinates(body: unknown): [number, number][] | null {
  if (!isRecord(body) || body['code'] !== 'Ok' || !Array.isArray(body['routes'])) return null;
  const route: unknown = body['routes'][0];
  if (!isRecord(route) || !isRecord(route['geometry'])) return null;
  const coords = route['geometry']['coordinates'];
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const ok = coords.every(
    (c): c is [number, number] =>
      Array.isArray(c) && isLatLon([c[1], c[0]]),
  );
  return ok ? (coords as [number, number][]) : null;
}

/**
 * Chiến lược phân giải polyline:
 *  1. manual  → trả `edge.manualPolyline` (≥ 2 điểm).
 *  2. auto    → cache bộ nhớ → cache file `polyline-cache.json` → OSRM (đảo [lon,lat] → [lat,lon]) → ghi cache.
 *  3. lỗi/timeout OSRM → fallback đường thẳng giữa 2 node (không ghi cache để lần sau thử lại).
 */
@Injectable()
export class CompositeGeometryProvider extends AbstractGeometryProvider {
  private readonly logger = new Logger(CompositeGeometryProvider.name);
  private readonly cachePath: string;
  private readonly osrmBaseUrl: string;
  private readonly timeoutMs: number;

  private memory = new Map<string, CacheEntry>();
  private loaded: Promise<void> | null = null;
  private readonly inFlight = new Map<string, Promise<LatLon[]>>();
  private readonly failedAt = new Map<string, number>();
  /** Hàng đợi tuần tự cho OSRM public (lịch sự với server demo) và ghi file */
  private osrmQueue: Promise<unknown> = Promise.resolve();
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(config: ConfigService) {
    super();
    this.cachePath = resolveDataPath(config.get<string>('DATA_DIR', 'data'), 'polyline-cache.json');
    this.osrmBaseUrl = config
      .getOrThrow<string>('OSRM_BASE_URL')
      .replace(/\/+$/, '');
    this.timeoutMs = Number(config.get<string>('OSRM_TIMEOUT_MS', '6000'));
  }

  async resolveEdgePolyline(edge: InternalEdge, fromNode: InternalNode, toNode: InternalNode): Promise<LatLon[]> {
    const straight: LatLon[] = [
      [fromNode.lat, fromNode.lon],
      [toNode.lat, toNode.lon],
    ];
    if (edge.geometryMode === 'manual') {
      return edge.manualPolyline && edge.manualPolyline.length >= 2 ? edge.manualPolyline : straight;
    }
    await this.ensureLoaded();

    const key = CompositeGeometryProvider.cacheKey(fromNode, toNode);
    const hit = this.memory.get(key);
    if (hit) return hit.polyline;

    const lastFail = this.failedAt.get(key);
    if (lastFail && Date.now() - lastFail < RETRY_AFTER_FAILURE_MS) return straight;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const task = this.enqueueOsrm(() => this.fetchOsrm(fromNode, toNode))
      .then(async (polyline) => {
        if (!polyline) {
          this.failedAt.set(key, Date.now());
          return straight;
        }
        this.failedAt.delete(key);
        this.memory.set(key, { edgeId: edge.id, polyline, fetchedAt: new Date().toISOString() });
        await this.persist();
        return polyline;
      })
      .finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, task);
    return task;
  }

  /** Khoá cache theo toạ độ (6 chữ số thập phân ≈ 0.1 m) → đổi toạ độ node sẽ tự invalid cache */
  static cacheKey(from: InternalNode, to: InternalNode): string {
    const f = (n: number): string => n.toFixed(6);
    return `${f(from.lat)},${f(from.lon)}->${f(to.lat)},${f(to.lon)}`;
  }

  // ───────────────────────── internals ─────────────────────────

  private ensureLoaded(): Promise<void> {
    this.loaded ??= readFile(this.cachePath, 'utf8')
      .then((content) => {
        const parsed: unknown = JSON.parse(content);
        if (!isRecord(parsed) || !isRecord(parsed['entries'])) return;
        for (const [key, value] of Object.entries(parsed['entries'])) {
          if (isRecord(value) && isLatLonArray(value['polyline']) && value['polyline'].length >= 2) {
            this.memory.set(key, {
              edgeId: typeof value['edgeId'] === 'string' ? value['edgeId'] : '',
              polyline: value['polyline'],
              fetchedAt: typeof value['fetchedAt'] === 'string' ? value['fetchedAt'] : '',
            });
          }
        }
        this.logger.log(`Polyline cache loaded: ${this.memory.size} entries`);
      })
      .catch((err: unknown) => {
        if (isRecord(err) && err['code'] === 'ENOENT') return;
        this.logger.warn(`Polyline cache unreadable, starting empty: ${String(err)}`);
      });
    return this.loaded;
  }

  private enqueueOsrm<T>(job: () => Promise<T>): Promise<T> {
    const run = this.osrmQueue.then(job, job);
    this.osrmQueue = run.catch(() => undefined);
    return run;
  }

  private async fetchOsrm(from: InternalNode, to: InternalNode): Promise<LatLon[] | null> {
    const url =
      `${this.osrmBaseUrl}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}` +
      `?overview=full&geometries=geojson`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const coords = extractOsrmCoordinates((await res.json()) as unknown);
      if (!coords) throw new Error('unexpected OSRM payload');
      return coords.map(([lon, lat]) => [lat, lon]);
    } catch (err) {
      this.logger.warn(`OSRM failed for ${from.id} → ${to.id}, using straight line: ${String(err)}`);
      return null;
    }
  }

  /** Ghi atomically (tmp + rename), tuần tự hoá để tránh ghi chồng */
  private persist(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const data: CacheFile = { version: 1, entries: Object.fromEntries(this.memory) };
      const tmp = `${this.cachePath}.tmp`;
      try {
        await mkdir(path.dirname(this.cachePath), { recursive: true });
        await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
        await rename(tmp, this.cachePath);
      } catch (err) {
        this.logger.error(`Cannot write polyline cache: ${String(err)}`);
      }
    });
    return this.writeQueue;
  }
}
