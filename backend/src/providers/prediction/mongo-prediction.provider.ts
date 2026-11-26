import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import {
  PREDICTION_HISTORY_LIMIT,
  type InternalNode,
  type NodePrediction,
  type PredictionHorizon,
} from '../../common/domain/traffic.models.js';
import {
  HISTORY_RETENTION_SECONDS,
  NodePredictionHistory,
} from '../../database/schemas/node-prediction-history.schema.js';
import {
  LATEST_PREDICTION_TTL_SECONDS,
  NodePredictionLatest,
} from '../../database/schemas/node-prediction-latest.schema.js';
import {
  AbstractPredictionProvider,
  type NodeHistoryAndForecast,
} from './prediction.provider.abstract.js';

@Injectable()
export class MongoPredictionProvider extends AbstractPredictionProvider {
  constructor(
    @InjectModel(NodePredictionLatest.name)
    private readonly latest: Model<NodePredictionLatest>,
    @InjectModel(NodePredictionHistory.name)
    private readonly history: Model<NodePredictionHistory>,
  ) {
    super();
  }

  async predictNode(
    node: InternalNode,
    horizon: PredictionHorizon,
  ): Promise<NodePrediction> {
    return this.toPrediction(node, horizon, await this.findLatest(node.id));
  }

  async getNodeHistoryAndForecast(
    node: InternalNode,
    horizons: PredictionHorizon[],
    historyLimit = PREDICTION_HISTORY_LIMIT,
  ): Promise<NodeHistoryAndForecast> {
    const [latest, observations] = await Promise.all([
      this.findLatest(node.id),
      this.history
        .find({
          nodeId: node.id,
          timestamp: {
            $gt: new Date(Date.now() - HISTORY_RETENTION_SECONDS * 1000),
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
      forecasts: horizons.map((horizon) =>
        this.toPrediction(node, horizon, latest),
      ),
    };
  }

  private findLatest(nodeId: string): Promise<NodePredictionLatest | null> {
    // MongoDB TTL cleanup is asynchronous, so enforce freshness on reads.
    const cutoff = new Date(Date.now() - LATEST_PREDICTION_TTL_SECONDS * 1000);
    return this.latest
      .findOne({ nodeId, updatedAt: { $gt: cutoff } })
      .lean()
      .exec();
  }

  private toPrediction(
    node: InternalNode,
    horizon: PredictionHorizon,
    latest: NodePredictionLatest | null,
  ): NodePrediction {
    const forecast = latest?.forecasts.find(
      (item) => item.horizonMinutes === horizon,
    );
    const predictedSpeedRatio = forecast?.predictedSpeedRatio ?? 0;
    const observedAt = latest?.observedAt.getTime() ?? Date.now();
    return {
      nodeId: node.id,
      horizonMinutes: horizon,
      currentSpeedRatio: latest?.currentSpeedRatio ?? 0,
      predictedSpeedRatio,
      predictedSpeedKmh: predictedSpeedRatio * node.speedLimitKmh,
      confidence: forecast ? (latest?.confidence ?? 0) : 0,
      status: forecast?.status ?? 'UNKNOWN',
      timestamp: new Date(observedAt + horizon * 60_000).toISOString(),
    };
  }
}
