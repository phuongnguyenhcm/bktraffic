import { LOCAL_IDENTIFIER_PATTERN, type LatLon } from '../domain/traffic.models.js';

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
  polyline?: LatLon[];
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
    if (!LOCAL_IDENTIFIER_PATTERN.test(id) || !isRecord(value)) {
      warnings.push(`Invalid local node ID or node object: "${id}"`);
      continue;
    }
    const coordinates = [value['lat'], value['lon']];
    if (!isLatLon(coordinates)) {
      warnings.push(`Node "${id}" must have valid numeric lat/lon`);
      continue;
    }
    const node: TargetConfigNode = { lat: coordinates[0], lon: coordinates[1] };
    const name = value['name'];
    if (typeof name === 'string' && name.trim() && name.length <= 120) node.name = name.trim();
    else if (name !== undefined) warnings.push(`Node "${id}" has an invalid name`);
    const index = value['index'];
    if (typeof index === 'number' && Number.isSafeInteger(index) && index >= 0) node.index = index;
    else if (index !== undefined) warnings.push(`Node "${id}" has an invalid index`);
    const speed = value['speed_limit'];
    if (isFiniteNumber(speed) && speed > 0) {
      node.speed_limit = speed;
    } else if (speed !== undefined) {
      warnings.push(`Node "${id}" has an invalid speed_limit`);
    }
    const polyline = value['polyline'];
    if (isLatLonArray(polyline) && polyline.length >= 2) node.polyline = polyline;
    else if (polyline !== undefined) warnings.push(`Node "${id}" has an invalid polyline`);
    nodes.set(id, node);
  }

  const rawConnections = raw['connections'];
  if (rawConnections !== undefined && !Array.isArray(rawConnections)) {
    throw new Error('target.json: "connections" must be an array');
  }
  const entries: unknown[] = rawConnections ?? [];
  for (const [i, value] of entries.entries()) {
    if (!isRecord(value) || typeof value['from'] !== 'string' || typeof value['to'] !== 'string' ||
      (value['is_one_way'] !== undefined && typeof value['is_one_way'] !== 'boolean')) {
      warnings.push(`Connection #${i} must have from and to, with boolean is_one_way when provided`);
      continue;
    }
    const conn: TargetConfigConnection = {
      from: value['from'],
      to: value['to'],
      is_one_way: value['is_one_way'] ?? false,
    };
    const mode = value['geometry_mode'];
    if (mode === 'auto' || mode === 'manual') conn.geometry_mode = mode;
    else if (mode !== undefined) warnings.push(`Connection #${i} has an invalid geometry_mode`);
    if (value['polyline'] !== undefined) {
      if (isLatLonArray(value['polyline']) && value['polyline'].length >= 2 && value['polyline'].length <= 2000) {
        conn.polyline = value['polyline'];
      }
      else warnings.push(`connection ${conn.from} → ${conn.to}: invalid polyline ignored`);
    }
    if (mode === 'manual' && !conn.polyline) warnings.push(`Connection #${i} requires a manual polyline`);
    connections.push(conn);
  }

  return { config: { nodes: Object.fromEntries(nodes), connections }, warnings };
}
