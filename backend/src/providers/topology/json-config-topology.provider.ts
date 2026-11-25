import { readFile } from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildEdgeId,
  DEFAULT_GEOMETRY_MODE,
  DEFAULT_SPEED_LIMIT_KMH,
  type InternalEdge,
  type InternalNode,
} from '../../common/domain/traffic.models.js';
import { parseTargetConfig } from '../../common/config/target-config.js';
import { MtimeCachedFile, parseCsv, resolveDataPath } from '../../common/data/data-files.js';
import { AbstractTopologyProvider } from './topology.provider.abstract.js';

interface DirectionInfo {
  index: number;
  direction: string;
  lat: number;
  lon: number;
}

interface Topology {
  nodes: InternalNode[];
  edges: InternalEdge[];
}

/** Ngưỡng lệch toạ độ (m) giữa target.json và direction_info.csv để cảnh báo */
const COORD_MISMATCH_WARN_M = 50;

/** "LyThuongKiet+CMT8" → "Ly Thuong Kiet × CMT8", "3T2_1" → "3T2 · 1" */
export function humanizeNodeId(id: string): string {
  return id
    .split('+')
    .map((part) =>
      part
        .replace(/_/g, ' · ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .trim(),
    )
    .join(' × ');
}

function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = (d: number): number => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/**
 * Đọc `target.json` (nguồn chuẩn của topology) và đối chiếu `index`
 * từ `direction_info.csv` (ánh xạ index ↔ tên node dùng trong tensor/CSV tốc độ).
 * Nếu target.json không có `connections`, fallback sang `connections.csv`.
 */
@Injectable()
export class JsonConfigTopologyProvider extends AbstractTopologyProvider {
  private readonly logger = new Logger(JsonConfigTopologyProvider.name);
  private readonly targetFile: MtimeCachedFile<unknown>;
  private readonly directionFile: MtimeCachedFile<DirectionInfo[]>;
  private readonly connectionsCsvPath: string;
  private cache: { target: unknown; directions: DirectionInfo[]; topology: Topology } | null = null;

  constructor(config: ConfigService) {
    super();
    const dataDir = config.get<string>('DATA_DIR', 'data');
    this.targetFile = new MtimeCachedFile<unknown>(
      resolveDataPath(dataDir, 'target.json'),
      (c) => JSON.parse(c) as unknown,
    );
    this.directionFile = new MtimeCachedFile<DirectionInfo[]>(
      resolveDataPath(dataDir, 'direction_info.csv'),
      (c) =>
        parseCsv(c)
          .map((r) => ({
            index: r['index'] ? Number(r['index']) : NaN,
            direction: r['direction'] ?? '',
            lat: Number(r['lat']),
            lon: Number(r['lon']),
          }))
          .filter((d) => Number.isInteger(d.index) && d.index >= 0 && d.direction !== ''),
    );
    this.connectionsCsvPath = resolveDataPath(dataDir, 'connections.csv');
  }

  async getNodes(): Promise<InternalNode[]> {
    return (await this.load()).nodes;
  }

  async getEdges(): Promise<InternalEdge[]> {
    return (await this.load()).edges;
  }

  private async load(): Promise<Topology> {
    const [target, directions] = await Promise.all([this.targetFile.get(), this.directionFile.get()]);
    if (this.cache && this.cache.target === target && this.cache.directions === directions) {
      return this.cache.topology;
    }
    const topology = await this.build(target, directions);
    this.cache = { target, directions, topology };
    this.logger.log(`Topology loaded: ${topology.nodes.length} nodes, ${topology.edges.length} edges`);
    return topology;
  }

  private async build(target: unknown, directions: DirectionInfo[]): Promise<Topology> {
    const { config, warnings } = parseTargetConfig(target);
    warnings.forEach((w) => this.logger.warn(w));

    const byName = new Map(directions.map((d) => [d.direction, d]));
    const csvIndices = new Set(directions.map((d) => d.index));
    const matchedIndices = new Set(
      directions.filter((d) => Object.hasOwn(config.nodes, d.direction)).map((d) => d.index),
    );
    const usedIndices = new Set<number>();
    const nodes: InternalNode[] = [];
    const pendingIndex: InternalNode[] = [];

    for (const [id, raw] of Object.entries(config.nodes)) {
      const info = byName.get(id);
      const node: InternalNode = {
        id,
        index: info?.index ?? raw.index ?? -1,
        name: raw.name ?? humanizeNodeId(id),
        lat: raw.lat,
        lon: raw.lon,
        speedLimitKmh: raw.speed_limit ?? DEFAULT_SPEED_LIMIT_KMH,
      };
      if (info && distanceMeters(info.lat, info.lon, raw.lat, raw.lon) > COORD_MISMATCH_WARN_M) {
        this.logger.warn(`node "${id}": coordinates differ between target.json and direction_info.csv`);
      }
      if (
        !Number.isInteger(node.index) ||
        node.index < 0 ||
        usedIndices.has(node.index) ||
        (!info && matchedIndices.has(node.index))
      ) {
        pendingIndex.push(node);
      } else {
        usedIndices.add(node.index);
      }
      nodes.push(node);
    }

    // Cấp index mới ngoài các index cảm biến để không gán nhầm dữ liệu tốc độ.
    let next = 0;
    for (const node of pendingIndex) {
      while (csvIndices.has(next) || usedIndices.has(next)) next++;
      this.logger.warn(`node "${node.id}" has no available sensor index → assigned index ${next}`);
      node.index = next;
      usedIndices.add(next);
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    let connections = config.connections;
    if (connections.length === 0) connections = await this.connectionsFromCsv(directions);

    const edges: InternalEdge[] = [];
    const seen = new Map<string, boolean>();
    for (const c of connections) {
      if (!nodeIds.has(c.from) || !nodeIds.has(c.to) || c.from === c.to) {
        this.logger.warn(`connection ${c.from} → ${c.to} ignored: unknown node`);
        continue;
      }
      const id = buildEdgeId(c.from, c.to);
      // Cạnh hai chiều chỉ giữ một bản (A__B), tránh vẽ trùng
      const reverse = buildEdgeId(c.to, c.from);
      if (seen.has(id) || seen.get(reverse) === false || (!c.is_one_way && seen.has(reverse))) continue;
      seen.set(id, c.is_one_way);

      const mode = c.geometry_mode ?? DEFAULT_GEOMETRY_MODE;
      const edge: InternalEdge = {
        id,
        fromNodeId: c.from,
        toNodeId: c.to,
        isOneWay: c.is_one_way,
        geometryMode: mode,
      };
      if (mode === 'manual') {
        if (c.polyline && c.polyline.length >= 2) edge.manualPolyline = c.polyline;
        else this.logger.warn(`edge ${id}: manual mode without valid polyline (≥ 2 points)`);
      }
      edges.push(edge);
    }

    return { nodes: nodes.sort((a, b) => a.index - b.index), edges };
  }

  private async connectionsFromCsv(directions: DirectionInfo[]) {
    const byIndex = new Map(directions.map((d) => [d.index, d.direction]));
    try {
      const rows = parseCsv(await readFile(this.connectionsCsvPath, 'utf8'));
      const pairs = rows
        .map((r) => ({ from: byIndex.get(Number(r['From'])), to: byIndex.get(Number(r['To'])) }))
        .filter((p): p is { from: string; to: string } => !!p.from && !!p.to);
      const keys = new Set(pairs.map((p) => `${p.from}__${p.to}`));
      return pairs.map((p) => ({ ...p, is_one_way: !keys.has(`${p.to}__${p.from}`) }));
    } catch {
      this.logger.warn('connections.csv not available — topology has no edges');
      return [];
    }
  }
}
