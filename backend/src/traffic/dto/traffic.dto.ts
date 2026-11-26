import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  MAX_FORECAST_HORIZON_MINUTES,
  PREDICTION_HISTORY_LIMIT,
  type GeometryMode,
  type InternalNode,
  type LatLon,
  type NodePrediction,
  type PredictionHorizon,
  type SpeedHistoryPoint,
  type TrafficStatus,
} from '../../common/domain/traffic.models.js';

// ───────────────────────── Request DTOs ─────────────────────────

export class MapQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_FORECAST_HORIZON_MINUTES)
  horizon: PredictionHorizon = 10;
}

export class HistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(288)
  limit = PREDICTION_HISTORY_LIMIT;
}

// ───────────────────────── Response DTOs ─────────────────────────
// Chỉ chứa trường canonical — không có FRC / freeFlowSpeed / travelTime.

export interface MapNodeDto extends InternalNode {
  localId: string;
  polyline: LatLon[];
  currentSpeedRatio: number;
  currentSpeedKmh: number;
  predictedSpeed: number; // km/h
  speedRatio: number; // predicted speed relative to the speed limit
  predictedSpeedRatio: number;
  predictedSpeedKmh: number;
  confidence: number;
  status: TrafficStatus;
  timestamp: string;
  targetTimestamp: string | null;
  timeBucket: number | null;
  latestGeneratedAt: string | null;
}

export interface MapEdgeDto {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  isOneWay: boolean;
  geometryMode: GeometryMode;
  polyline: LatLon[];
  predictedSpeedRatio: number;
  predictedSpeedKmh: number;
  confidence: number;
  status: TrafficStatus;
}

export interface MapSummaryDto {
  clear: number;
  moderate: number;
  congested: number;
}

export interface TrafficMapResponseDto {
  horizonMinutes: PredictionHorizon;
  generatedAt: string;
  targetTimestamp: string | null;
  timeBucket: number | null;
  latestGeneratedAt: string | null;
  /** Thời điểm mẫu cảm biến mới nhất dùng làm "hiện tại" cho dự báo */
  dataTimestamp: string | null;
  nodes: MapNodeDto[];
  edges: MapEdgeDto[];
  summary: MapSummaryDto;
}

export interface NodeHistoryResponseDto {
  node: InternalNode;
  history: SpeedHistoryPoint[];
  forecasts: NodePrediction[];
}
