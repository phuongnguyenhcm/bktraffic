/**
 * Canonical Internal Domain Models — Agents.md §3.
 * Mọi service nội bộ chỉ giao tiếp bằng các kiểu dưới đây.
 * KHÔNG đưa các trường đặc thù của TomTom (FRC, freeFlowSpeed, travelTime, ...) vào đây.
 */

export type PredictionHorizon = 5 | 10 | 30 | 60; // minutes
export const REPORTED_TRAFFIC_STATUSES = ['CLEAR', 'MODERATE', 'CONGESTED'] as const;
export type TrafficStatus = (typeof REPORTED_TRAFFIC_STATUSES)[number] | 'UNKNOWN';
export type GeometryMode = 'auto' | 'manual';
export type LatLon = [number, number]; // [lat, lon] for Leaflet compatibility

export const PREDICTION_HORIZONS: readonly PredictionHorizon[] = [5, 10, 30, 60];
export const PREDICTION_HISTORY_LIMIT = 30;
export const CSV_SEED_AGENT_ID = 'agent-q10-bk';
export const DEFAULT_SPEED_LIMIT_KMH = 40;
export const DEFAULT_GEOMETRY_MODE: GeometryMode = 'auto';
export const EDGE_AGENT_ONLINE_WINDOW_MS = 15 * 60_000;
export const LOCAL_IDENTIFIER_PATTERN = /^[A-Za-z0-9_+.-]{1,64}$/;
export const PREDICTION_NODE_ID_PATTERN = /^(?:[A-Za-z0-9_+.-]{1,64}::)?[A-Za-z0-9_+.-]{1,64}$/;

export interface InternalNode {
  id: string; // Unique string identifier (e.g., "LyThuongKiet+CMT8")
  index: number; // Numeric index mapped to ML model tensors/CSV
  name: string; // Human-readable display name
  lat: number;
  lon: number;
  speedLimitKmh: number; // Physical road speed limit (from config, default: 40)
  polyline?: LatLon[];
}

export interface InternalEdge {
  id: string; // e.g., "LyThuongKiet+CMT8__ToHienThanh"
  fromNodeId: string;
  toNodeId: string;
  isOneWay: boolean;
  geometryMode: GeometryMode;
  manualPolyline?: LatLon[]; // Present only when geometryMode === 'manual'
}

export interface RegisteredNode extends InternalNode {
  localId: string;
}

export interface ResolvedEdge extends InternalEdge {
  resolvedPolyline: LatLon[];
}

export interface RegisteredTopology {
  nodes: RegisteredNode[];
  edges: ResolvedEdge[];
}

export interface EdgeAgentIdentity {
  agentId: string;
  name: string;
  region: string;
}

export interface EdgeAgentSummary extends EdgeAgentIdentity {
  id: string;
  status: 'ONLINE' | 'OFFLINE';
  lastSeenAt: string;
  lastHeartbeat: string;
  managedNodeIds: string[];
  managedNodeCount: number;
}

export interface NodePrediction {
  nodeId: string;
  horizonMinutes: PredictionHorizon;
  currentSpeedRatio: number; // Normalized [0.0, 1.0]
  predictedSpeedRatio: number; // Normalized [0.0, 1.0]
  predictedSpeedKmh: number; // Derived: predictedSpeedRatio * speedLimitKmh
  confidence: number; // [0.0, 1.0]
  status: TrafficStatus;
  timestamp: string; // ISO 8601 — thời điểm mà dự báo có hiệu lực (now + horizon)
}

export interface SpeedHistoryPoint {
  timestamp: string;
  speedRatio: number;
  speedKmh: number;
}

export interface EdgeForecast {
  horizonMinutes: PredictionHorizon;
  predictedSpeedRatio: number;
  status: (typeof REPORTED_TRAFFIC_STATUSES)[number];
}

export interface EdgePredictionReport {
  nodeId: string;
  edgeAgentId: string;
  currentSpeedRatio: number;
  confidence: number;
  forecasts: EdgeForecast[];
  observedAt: Date;
}

/** Ngưỡng phân loại theo Agents.md §7 */
export const STATUS_THRESHOLDS = { clear: 0.75, moderate: 0.45 } as const;

export function classifyTrafficStatus(speedRatio: number): EdgeForecast['status'] {
  if (speedRatio >= STATUS_THRESHOLDS.clear) return 'CLEAR';
  if (speedRatio >= STATUS_THRESHOLDS.moderate) return 'MODERATE';
  return 'CONGESTED';
}

export function isPredictionHorizon(value: number): value is PredictionHorizon {
  return (PREDICTION_HORIZONS as readonly number[]).includes(value);
}

export function buildEdgeId(fromNodeId: string, toNodeId: string): string {
  return `${fromNodeId}__${toNodeId}`;
}

export function buildGlobalNodeId(agentId: string, localId: string): string {
  return `${agentId}::${localId}`;
}
