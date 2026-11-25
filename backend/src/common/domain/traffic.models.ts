/**
 * Canonical Internal Domain Models — Agents.md §3.
 * Mọi service nội bộ chỉ giao tiếp bằng các kiểu dưới đây.
 * KHÔNG đưa các trường đặc thù của TomTom (FRC, freeFlowSpeed, travelTime, ...) vào đây.
 */

export type PredictionHorizon = 5 | 10 | 30 | 60; // minutes
export type TrafficStatus = 'CLEAR' | 'MODERATE' | 'CONGESTED';
export type GeometryMode = 'auto' | 'manual';
export type LatLon = [number, number]; // [lat, lon] for Leaflet compatibility

export const PREDICTION_HORIZONS: readonly PredictionHorizon[] = [5, 10, 30, 60];
export const DEFAULT_SPEED_LIMIT_KMH = 40;
export const DEFAULT_GEOMETRY_MODE: GeometryMode = 'auto';

export interface InternalNode {
  id: string; // Unique string identifier (e.g., "LyThuongKiet+CMT8")
  index: number; // Numeric index mapped to ML model tensors/CSV
  name: string; // Human-readable display name
  lat: number;
  lon: number;
  speedLimitKmh: number; // Physical road speed limit (from config, default: 40)
}

export interface InternalEdge {
  id: string; // e.g., "LyThuongKiet+CMT8__ToHienThanh"
  fromNodeId: string;
  toNodeId: string;
  isOneWay: boolean;
  geometryMode: GeometryMode;
  manualPolyline?: LatLon[]; // Present only when geometryMode === 'manual'
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

/** Ngưỡng phân loại theo Agents.md §7 */
export const STATUS_THRESHOLDS = { clear: 0.75, moderate: 0.45 } as const;

export function classifyTrafficStatus(speedRatio: number): TrafficStatus {
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
