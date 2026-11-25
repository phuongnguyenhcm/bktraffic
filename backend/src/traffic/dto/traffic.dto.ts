import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  PREDICTION_HORIZONS,
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
  @IsIn(PREDICTION_HORIZONS, { message: 'horizon must be one of 5, 10, 30, 60' })
  horizon: PredictionHorizon = 10;
}

export class HistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(288)
  limit = 24;
}

// ───────────────────────── Response DTOs ─────────────────────────
// Chỉ chứa trường canonical — không có FRC / freeFlowSpeed / travelTime.

export interface MapNodeDto extends InternalNode {
  currentSpeedRatio: number;
  currentSpeedKmh: number;
  predictedSpeedRatio: number;
  predictedSpeedKmh: number;
  confidence: number;
  status: TrafficStatus;
  timestamp: string;
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
