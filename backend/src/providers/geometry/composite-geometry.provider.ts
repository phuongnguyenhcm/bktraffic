import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { DEFAULT_SPEED_LIMIT_KMH, type InternalEdge, type InternalNode, type LatLon } from '../../common/domain/traffic.models.js';
import { isLatLon, isLatLonArray } from '../../common/config/target-config.js';
import { PolylineCache } from '../../database/schemas/polyline-cache.schema.js';
import type { ResolvedSegmentDto } from '../../topology/resolve-segment.dto.js';
import { TomTomService } from '../../topology/tomtom.service.js';
import { AbstractGeometryProvider } from './geometry.provider.abstract.js';

type GeometryResult = Omit<PolylineCache, 'cacheKey' | 'provider'> & { provider?: string };

/** Sau khi OSRM lỗi, không thử lại cùng cạnh trong khoảng này (tránh dồn request khi offline) */
const RETRY_AFTER_FAILURE_MS = 60_000;
const TOMTOM_PROVIDER = 'tomtom-flow';
const OSRM_PROVIDER = 'osrm';

function coordinateKey(lat: number, lon: number): string {
  const normalize = (coordinate: number) => (Math.round(coordinate * 1e6) / 1e6).toFixed(6);
  return `${normalize(lat)},${normalize(lon)}`;
}

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

@Injectable()
export class CompositeGeometryProvider extends AbstractGeometryProvider implements OnModuleInit {
  private readonly logger = new Logger(CompositeGeometryProvider.name);
  private readonly osrmBaseUrl: string;
  private readonly timeoutMs: number;

  private readonly inFlight = new Map<string, Promise<GeometryResult>>();
  private readonly failedAt = new Map<string, number>();
  /** Hàng đợi tuần tự cho OSRM public */
  private osrmQueue: Promise<unknown> = Promise.resolve();

  constructor(
    config: ConfigService,
    @InjectModel(PolylineCache.name) private readonly cache: Model<PolylineCache>,
    private readonly tomtom: TomTomService,
  ) {
    super();
    this.osrmBaseUrl = config
      .getOrThrow<string>('OSRM_BASE_URL')
      .replace(/\/+$/, '');
    this.timeoutMs = Number(config.get<string>('OSRM_TIMEOUT_MS', '6000'));
  }

  async onModuleInit(): Promise<void> {
    await this.cache.init();
  }

  async resolveSegment(lat: number, lon: number): Promise<ResolvedSegmentDto> {
    const cacheKey = `${TOMTOM_PROVIDER}:${coordinateKey(lat, lon)}`;
    const segment = await this.resolveCached(cacheKey, async () => ({
      ...await this.tomtom.resolveSegment(lat, lon),
      provider: TOMTOM_PROVIDER,
    }));
    return {
      lat: segment.lat,
      lon: segment.lon,
      polyline: segment.polyline,
      speedLimitKmh: segment.speedLimitKmh ?? DEFAULT_SPEED_LIMIT_KMH,
      ...(segment.frc !== undefined ? { frc: segment.frc } : {}),
    };
  }

  async resolveEdgePolyline(edge: InternalEdge, fromNode: InternalNode, toNode: InternalNode): Promise<LatLon[]> {
    const { lat, lon } = fromNode;
    const straight: LatLon[] = [
      [lat, lon],
      [toNode.lat, toNode.lon],
    ];
    if (edge.geometryMode === 'manual') {
      return edge.manualPolyline && edge.manualPolyline.length >= 2 ? edge.manualPolyline : straight;
    }
    const cacheKey = `${OSRM_PROVIDER}:${coordinateKey(lat, lon)}->${coordinateKey(toNode.lat, toNode.lon)}`;
    const fallback = { lat, lon, polyline: straight };
    const route = await this.resolveCached(cacheKey, async () => {
      const lastFail = this.failedAt.get(cacheKey);
      if (lastFail !== undefined && Date.now() - lastFail < RETRY_AFTER_FAILURE_MS) return fallback;

      const polyline = await this.enqueueOsrm(() => this.fetchOsrm(fromNode, toNode));
      if (!polyline) {
        this.failedAt.set(cacheKey, Date.now());
        return fallback;
      }
      this.failedAt.delete(cacheKey);
      return { lat, lon, polyline, provider: OSRM_PROVIDER };
    });
    return route.polyline;
  }

  private resolveCached(cacheKey: string, resolve: () => Promise<GeometryResult>): Promise<GeometryResult> {
    const pending = this.inFlight.get(cacheKey);
    if (pending) return pending;

    const filter = { cacheKey };
    const task = this.cache.findOne(filter).lean().exec().then(async (hit) => {
      if (hit && isLatLonArray(hit.polyline) && hit.polyline.length >= 2) return hit;

      const geometry = await resolve();
      if (geometry.provider) {
        await this.cache.updateOne(filter, { $set: geometry }, { upsert: true }).exec();
      }
      return geometry;
    }).finally(() => this.inFlight.delete(cacheKey));

    this.inFlight.set(cacheKey, task);
    return task;
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

}
