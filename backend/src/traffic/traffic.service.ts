import { Injectable, NotFoundException } from '@nestjs/common';
import {
  classifyTrafficStatus,
  PREDICTION_HORIZONS,
  type InternalEdge,
  type InternalNode,
  type NodePrediction,
  type PredictionHorizon,
} from '../common/domain/traffic.models.js';
import { AbstractTopologyProvider } from '../providers/topology/topology.provider.abstract.js';
import { AbstractPredictionProvider } from '../providers/prediction/prediction.provider.abstract.js';
import { AbstractGeometryProvider } from '../providers/geometry/geometry.provider.abstract.js';
import type {
  MapEdgeDto,
  MapNodeDto,
  MapSummaryDto,
  NodeHistoryResponseDto,
  TrafficMapResponseDto,
} from './dto/traffic.dto.js';

const round = (v: number, d = 3): number => Math.round(v * 10 ** d) / 10 ** d;

@Injectable()
export class TrafficService {
  constructor(
    private readonly topology: AbstractTopologyProvider,
    private readonly prediction: AbstractPredictionProvider,
    private readonly geometry: AbstractGeometryProvider,
  ) {}

  /**
   * Agents.md §5 — thứ tự thực thi nghiêm ngặt:
   * (1) validate (DTO) → (2) topology → (3) inference → (4) geometry chỉ khi lắp response.
   */
  async getMap(horizon: PredictionHorizon): Promise<TrafficMapResponseDto> {
    // (2) Load topology
    const [nodes, edges] = await Promise.all([this.topology.getNodes(), this.topology.getEdges()]);

    // (3) Run inference — chỉ làm việc trên canonical models
    const predictions = await Promise.all(nodes.map((n) => this.prediction.predictNode(n, horizon)));
    const predById = new Map(predictions.map((p) => [p.nodeId, p]));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // (4) Response boundary — lúc này mới phân giải polyline
    const edgeDtos = await Promise.all(edges.map((e) => this.toEdgeDto(e, nodeById, predById)));
    const nodeDtos = nodes.map((n) => this.toNodeDto(n, predById.get(n.id)));

    const summary: MapSummaryDto = { clear: 0, moderate: 0, congested: 0 };
    nodeDtos.forEach((n) => {
      if (n.status === 'CLEAR') summary.clear++;
      else if (n.status === 'MODERATE') summary.moderate++;
      else summary.congested++;
    });

    const latest = predictions
      .filter((p) => p.confidence > 0)
      .map((p) => Date.parse(p.timestamp) - horizon * 60_000)
      .reduce<number | null>((max, t) => (max === null || t > max ? t : max), null);

    return {
      horizonMinutes: horizon,
      generatedAt: new Date().toISOString(),
      dataTimestamp: latest === null ? null : new Date(latest).toISOString(),
      nodes: nodeDtos,
      edges: edgeDtos.filter((e): e is MapEdgeDto => e !== null),
      summary,
    };
  }

  async getNodeHistory(nodeId: string, limit: number): Promise<NodeHistoryResponseDto> {
    const node = (await this.topology.getNodes()).find((n) => n.id === nodeId);
    if (!node) throw new NotFoundException(`Node "${nodeId}" not found`);
    const { history, forecasts } = await this.prediction.getNodeHistoryAndForecast(
      node,
      [...PREDICTION_HORIZONS],
      limit,
    );
    return { node, history, forecasts };
  }

  // ───────────────────────── mapping ─────────────────────────

  private toNodeDto(node: InternalNode, p: NodePrediction | undefined): MapNodeDto {
    const current = p?.currentSpeedRatio ?? 1;
    const predicted = p?.predictedSpeedRatio ?? 1;
    return {
      ...node,
      currentSpeedRatio: current,
      currentSpeedKmh: round(current * node.speedLimitKmh, 1),
      predictedSpeedRatio: predicted,
      predictedSpeedKmh: p?.predictedSpeedKmh ?? round(predicted * node.speedLimitKmh, 1),
      confidence: p?.confidence ?? 0,
      status: p?.status ?? classifyTrafficStatus(predicted),
      timestamp: p?.timestamp ?? new Date().toISOString(),
    };
  }

  /**
   * Chỉ số của một cạnh = trung bình hai node đầu mút (đại diện cho đoạn đường giữa 2 điểm đo);
   * độ tin cậy lấy giá trị nhỏ nhất (thận trọng).
   */
  private async toEdgeDto(
    edge: InternalEdge,
    nodeById: Map<string, InternalNode>,
    predById: Map<string, NodePrediction>,
  ): Promise<MapEdgeDto | null> {
    const from = nodeById.get(edge.fromNodeId);
    const to = nodeById.get(edge.toNodeId);
    if (!from || !to) return null;

    const pf = predById.get(from.id);
    const pt = predById.get(to.id);
    const ratio = round(((pf?.predictedSpeedRatio ?? 1) + (pt?.predictedSpeedRatio ?? 1)) / 2);
    const kmh = round(((pf?.predictedSpeedKmh ?? from.speedLimitKmh) + (pt?.predictedSpeedKmh ?? to.speedLimitKmh)) / 2, 1);
    const polyline = await this.geometry.resolveEdgePolyline(edge, from, to);

    return {
      id: edge.id,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      isOneWay: edge.isOneWay,
      geometryMode: edge.geometryMode,
      polyline,
      predictedSpeedRatio: ratio,
      predictedSpeedKmh: kmh,
      confidence: Math.min(pf?.confidence ?? 0, pt?.confidence ?? 0),
      status: classifyTrafficStatus(ratio),
    };
  }
}
