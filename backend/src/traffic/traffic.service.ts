import { Injectable, NotFoundException } from '@nestjs/common';
import {
  classifyTrafficStatus,
  PREDICTION_HORIZONS,
  type InternalNode,
  type RegisteredNode,
  type ResolvedEdge,
  type NodePrediction,
  type PredictionHorizon,
} from '../common/domain/traffic.models.js';
import { AbstractTopologyProvider } from '../providers/topology/topology.provider.abstract.js';
import { AbstractPredictionProvider } from '../providers/prediction/prediction.provider.abstract.js';
import { ForecastBucketingService } from '../providers/prediction/forecast-bucketing.service.js';
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
    private readonly buckets: ForecastBucketingService,
  ) {}

  async getMap(horizon: PredictionHorizon): Promise<TrafficMapResponseDto> {
    const now = new Date();
    const { nodes, edges } = await this.topology.getTopology();

    // (3) Run inference — chỉ làm việc trên canonical models
    const predictions = await this.prediction.predictNodes(nodes, horizon, now);
    const predById = new Map(predictions.map((p) => [p.nodeId, p]));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    const edgeDtos = edges.map((edge) => this.toEdgeDto(edge, nodeById, predById));
    const nodeDtos = nodes.map((n) => this.toNodeDto(n, predById.get(n.id)));

    const summary: MapSummaryDto = { clear: 0, moderate: 0, congested: 0 };
    nodeDtos.forEach((n) => {
      if (n.status === 'CLEAR') summary.clear++;
      else if (n.status === 'MODERATE') summary.moderate++;
      else if (n.status === 'CONGESTED') summary.congested++;
    });

    const requestedTime = this.buckets.requestedTime(now, horizon);
    let closest: NodePrediction | undefined;
    let latestGeneratedAt: string | null = null;
    let dataTimestamp: string | null = null;
    for (const prediction of predictions) {
      const { targetTimestamp, latestGeneratedAt: generatedAt, observedAt } = prediction;
      if (targetTimestamp && (!closest?.targetTimestamp || this.buckets.compareTargets(
        requestedTime, new Date(targetTimestamp), new Date(closest.targetTimestamp),
      ) < 0)) closest = prediction;
      if (generatedAt && (!latestGeneratedAt || generatedAt > latestGeneratedAt)) latestGeneratedAt = generatedAt;
      if (observedAt && (!dataTimestamp || observedAt > dataTimestamp)) dataTimestamp = observedAt;
    }

    return {
      horizonMinutes: horizon,
      generatedAt: now.toISOString(),
      dataTimestamp,
      targetTimestamp: closest?.targetTimestamp ?? null,
      timeBucket: closest?.timeBucket ?? null,
      latestGeneratedAt,
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

  private toNodeDto(node: RegisteredNode, p: NodePrediction | undefined): MapNodeDto {
    const current = p?.currentSpeedRatio ?? 0;
    const predicted = p?.predictedSpeedRatio ?? 0;
    const predictedSpeedKmh = p?.predictedSpeedKmh ?? round(predicted * node.speedLimitKmh, 1);
    return {
      ...node,
      polyline: node.polyline?.length ? node.polyline : [[node.lat, node.lon]],
      currentSpeedRatio: current,
      currentSpeedKmh: round(current * node.speedLimitKmh, 1),
      predictedSpeed: predictedSpeedKmh,
      speedRatio: predicted,
      predictedSpeedRatio: predicted,
      predictedSpeedKmh,
      confidence: p?.confidence ?? 0,
      status: p?.status ?? 'UNKNOWN',
      timestamp: p?.timestamp ?? new Date().toISOString(),
      targetTimestamp: p?.targetTimestamp ?? null,
      timeBucket: p?.timeBucket ?? null,
      latestGeneratedAt: p?.latestGeneratedAt ?? null,
    };
  }

  /**
   * Chỉ số liên kết đồ thị lấy trung bình dự báo hai đầu mút và độ tin cậy thấp nhất.
   */
  private toEdgeDto(
    edge: ResolvedEdge,
    nodeById: Map<string, InternalNode>,
    predById: Map<string, NodePrediction>,
  ): MapEdgeDto | null {
    const from = nodeById.get(edge.fromNodeId);
    const to = nodeById.get(edge.toNodeId);
    if (!from || !to) return null;

    const pf = predById.get(from.id);
    const pt = predById.get(to.id);
    const hasPrediction = pf && pt && pf.status !== 'UNKNOWN' && pt.status !== 'UNKNOWN';
    const ratio = hasPrediction ? round((pf.predictedSpeedRatio + pt.predictedSpeedRatio) / 2) : 0;
    const kmh = hasPrediction ? round((pf.predictedSpeedKmh + pt.predictedSpeedKmh) / 2, 1) : 0;

    return {
      id: edge.id,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      isOneWay: edge.isOneWay,
      geometryMode: edge.geometryMode,
      polyline: edge.resolvedPolyline,
      predictedSpeedRatio: ratio,
      predictedSpeedKmh: kmh,
      confidence: hasPrediction ? Math.min(pf.confidence, pt.confidence) : 0,
      status: hasPrediction ? classifyTrafficStatus(ratio) : 'UNKNOWN',
    };
  }
}
