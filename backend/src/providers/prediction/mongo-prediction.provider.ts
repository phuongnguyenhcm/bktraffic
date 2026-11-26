import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, PipelineStage } from 'mongoose';
import {
  classifyTrafficStatus,
  PREDICTION_HISTORY_LIMIT,
  type InternalNode,
  type NodePrediction,
  type PredictionHorizon,
} from '../../common/domain/traffic.models.js';
import {
  HISTORY_RETENTION_SECONDS,
  NodePredictionHistory,
} from '../../database/schemas/node-prediction-history.schema.js';
import { TrafficForecast } from '../../database/schemas/traffic-forecast.schema.js';
import { ForecastBucketingService } from './forecast-bucketing.service.js';
import {
  AbstractPredictionProvider,
  type NodeHistoryAndForecast,
} from './prediction.provider.abstract.js';

interface SpatialPrediction {
  _id: string;
  predictedSpeed: number;
  speedLimitKmh: number;
  currentSpeedRatio: number | null;
  confidence: number | null;
  targetTimestamp: Date;
  timeBucket: number;
  latestGeneratedAt: Date;
  observedAt: Date | null;
}

@Injectable()
export class MongoPredictionProvider extends AbstractPredictionProvider {
  constructor(
    @InjectModel(TrafficForecast.name)
    private readonly forecasts: Model<TrafficForecast>,
    @InjectModel(NodePredictionHistory.name)
    private readonly history: Model<NodePredictionHistory>,
    private readonly buckets: ForecastBucketingService,
  ) {
    super();
  }

  async predictNode(
    node: InternalNode,
    horizon: PredictionHorizon,
  ): Promise<NodePrediction> {
    const [prediction] = await this.predictNodes([node], horizon);
    return prediction;
  }

  override async predictNodes(
    nodes: readonly InternalNode[],
    horizon: PredictionHorizon,
    now = new Date(),
  ): Promise<NodePrediction[]> {
    if (!nodes.length) return [];
    const requestedTime = this.buckets.requestedTime(now, horizon);
    const keyedNodes = nodes.map((node) => ({
      node,
      spatialKey: this.buckets.spatialKey(node.id, node.lat, node.lon),
    }));
    // A node may have received a fallback-key forecast before it was registered.
    const keys = [
      ...new Set(
        keyedNodes.flatMap(({ node, spatialKey }) => [node.id, spatialKey]),
      ),
    ];
    const matches = await this.findMatches(keys, requestedTime);
    return keyedNodes.map(({ node, spatialKey }) =>
      this.toPrediction(
        node,
        horizon,
        requestedTime,
        matches.get(spatialKey) ?? matches.get(node.id),
      ),
    );
  }

  async getNodeHistoryAndForecast(
    node: InternalNode,
    horizons: PredictionHorizon[],
    historyLimit = PREDICTION_HISTORY_LIMIT,
  ): Promise<NodeHistoryAndForecast> {
    const now = new Date();
    const [forecasts, observations] = await Promise.all([
      Promise.all(
        horizons.map(async (horizon) => {
          const [prediction] = await this.predictNodes([node], horizon, now);
          return prediction;
        }),
      ),
      this.history
        .find({
          nodeId: node.id,
          timestamp: {
            $gt: new Date(now.getTime() - HISTORY_RETENTION_SECONDS * 1000),
          },
        })
        .sort({ timestamp: -1 })
        .limit(Math.min(historyLimit, PREDICTION_HISTORY_LIMIT))
        .lean()
        .exec(),
    ]);

    return {
      history: observations.reverse().map(({ timestamp, speedRatio }) => ({
        timestamp: timestamp.toISOString(),
        speedRatio,
        speedKmh: speedRatio * node.speedLimitKmh,
      })),
      forecasts,
    };
  }

  private async findMatches(
    spatialKeys: string[],
    requestedTime: Date,
  ): Promise<Map<string, SpatialPrediction>> {
    const { distance, nearestFirst } = this.buckets.matchRank(requestedTime);
    const pipeline: PipelineStage[] = [
      {
        $match: {
          spatialKey: { $in: spatialKeys },
          ...this.buckets.matchWindow(requestedTime),
        },
      },
      { $set: { distance } },
      { $sort: nearestFirst },
      {
        $group: {
          _id: { spatialKey: '$spatialKey', agentId: '$agentId' },
          nearest: { $first: '$$ROOT' },
        },
      },
      { $replaceWith: '$nearest' },
      { $sort: nearestFirst },
      {
        $group: {
          _id: '$spatialKey',
          predictedSpeed: { $avg: '$predictedSpeed' },
          speedLimitKmh: { $avg: '$speedLimitKmh' },
          currentSpeedRatio: { $avg: '$currentSpeedRatio' },
          confidence: { $avg: '$confidence' },
          targetTimestamp: { $first: '$targetTimestamp' },
          timeBucket: { $first: '$timeBucket' },
          latestGeneratedAt: { $max: '$generatedAt' },
          observedAt: { $max: '$observedAt' },
        },
      },
    ];
    const rows = await this.forecasts
      .aggregate<SpatialPrediction>(pipeline)
      .exec();
    return new Map(rows.map((row) => [row._id, row]));
  }

  private toPrediction(
    node: InternalNode,
    horizon: PredictionHorizon,
    requestedTime: Date,
    match?: SpatialPrediction,
  ): NodePrediction {
    const predictedSpeedKmh = match?.predictedSpeed ?? 0;
    const ratio = match ? predictedSpeedKmh / match.speedLimitKmh : 0;
    const targetTimestamp = match?.targetTimestamp.toISOString() ?? null;
    return {
      nodeId: node.id,
      horizonMinutes: horizon,
      currentSpeedRatio: match?.currentSpeedRatio ?? 0,
      predictedSpeedRatio: Math.min(1, ratio),
      predictedSpeedKmh,
      confidence: match?.confidence ?? 0,
      status: match ? classifyTrafficStatus(ratio) : 'UNKNOWN',
      timestamp: targetTimestamp ?? requestedTime.toISOString(),
      targetTimestamp,
      timeBucket: match?.timeBucket ?? null,
      latestGeneratedAt: match?.latestGeneratedAt.toISOString() ?? null,
      observedAt: match?.observedAt?.toISOString() ?? null,
    };
  }
}
