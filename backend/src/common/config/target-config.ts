import type { LatLon } from '../domain/traffic.models.js';

/**
 * Định dạng file cấu hình `target.json` do Edge User cung cấp.
 * Các trường mở rộng (`speed_limit`, `geometry_mode`, `polyline`, `name`, `index`) là tuỳ chọn
 * để tương thích ngược với file gốc chỉ có `lat/lon` và `from/to/is_one_way`.
 */
export interface TargetConfigNode {
  lat: number;
  lon: number;
  name?: string;
  index?: number;
  speed_limit?: number;
}

export interface TargetConfigConnection {
  from: string;
  to: string;
  is_one_way: boolean;
  geometry_mode?: 'auto' | 'manual';
  polyline?: LatLon[];
}

export interface TargetConfigFile {
  nodes: Record<string, TargetConfigNode>;
  connections: TargetConfigConnection[];
}

// ───────────── Type guards (không dùng `any`) ─────────────

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

export function isLatLon(v: unknown): v is LatLon {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    isFiniteNumber(v[0]) &&
    isFiniteNumber(v[1]) &&
    Math.abs(v[0]) <= 90 &&
    Math.abs(v[1]) <= 180
  );
}

export function isLatLonArray(v: unknown): v is LatLon[] {
  return Array.isArray(v) && v.every(isLatLon);
}

export interface ParseResult {
  config: TargetConfigFile;
  warnings: string[];
}

/** Parse & làm sạch nội dung target.json thô. Bỏ qua phần tử sai định dạng kèm cảnh báo. */
export function parseTargetConfig(raw: unknown): ParseResult {
  const warnings: string[] = [];
  const nodes = new Map<string, TargetConfigNode>();
  const connections: TargetConfigConnection[] = [];

  if (!isRecord(raw)) throw new Error('target.json: root must be an object');

  const rawNodes = raw['nodes'];
  if (!isRecord(rawNodes)) throw new Error('target.json: "nodes" must be an object');

  for (const [id, value] of Object.entries(rawNodes)) {
    if (!isRecord(value) || !isFiniteNumber(value['lat']) || !isFiniteNumber(value['lon'])) {
      warnings.push(`node "${id}" ignored: missing numeric lat/lon`);
      continue;
    }
    const node: TargetConfigNode = { lat: value['lat'], lon: value['lon'] };
    if (typeof value['name'] === 'string' && value['name'].trim()) node.name = value['name'].trim();
    if (isFiniteNumber(value['index'])) node.index = value['index'];
    if (isFiniteNumber(value['speed_limit']) && value['speed_limit'] > 0) {
      node.speed_limit = value['speed_limit'];
    }
    nodes.set(id, node);
  }

  const rawConnections = raw['connections'];
  if (rawConnections !== undefined && !Array.isArray(rawConnections)) {
    throw new Error('target.json: "connections" must be an array');
  }
  for (const [i, value] of (rawConnections ?? []).entries()) {
    if (!isRecord(value) || typeof value['from'] !== 'string' || typeof value['to'] !== 'string') {
      warnings.push(`connection #${i} ignored: missing from/to`);
      continue;
    }
    const conn: TargetConfigConnection = {
      from: value['from'],
      to: value['to'],
      is_one_way: value['is_one_way'] === true,
    };
    const mode = value['geometry_mode'];
    if (mode === 'auto' || mode === 'manual') conn.geometry_mode = mode;
    if (value['polyline'] !== undefined) {
      if (isLatLonArray(value['polyline'])) conn.polyline = value['polyline'];
      else warnings.push(`connection ${conn.from} → ${conn.to}: invalid polyline ignored`);
    }
    connections.push(conn);
  }

  return { config: { nodes: Object.fromEntries(nodes), connections }, warnings };
}
