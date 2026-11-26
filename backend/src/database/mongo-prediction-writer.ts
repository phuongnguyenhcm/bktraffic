import { Injectable, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { mongo, type AnyBulkWriteOperation, type Model } from 'mongoose';
import {
  DEFAULT_SPEED_LIMIT_KMH,
  type EdgePredictionReport,
  type InternalNode,
} from '../common/domain/traffic.models.js';
import { ForecastBucketingService } from '../providers/prediction/forecast-bucketing.service.js';
import { AbstractPredictionWriter } from '../providers/prediction/prediction-writer.abstract.js';
import { AbstractTopologyProvider } from '../providers/topology/topology.provider.abstract.js';
import { NodePredictionHistory } from './schemas/node-prediction-history.schema.js';
import {
  LATEST_PREDICTION_TTL_SECONDS,
  NodePredictionLatest,
} from './schemas/node-prediction-latest.schema.js';
import { TrafficForecast } from './schemas/traffic-forecast.schema.js';

function upsert(
  forecast: TrafficForecast,
): AnyBulkWriteOperation<TrafficForecast> {
  const { agentId, spatialKey, timeBucket, ...fields } = forecast;
  // Match only the unique key. A freshness predicate in the filter would try
  // to insert a duplicate whenever an older report arrives.
  const useIncoming = {
    $lte: [
      { $ifNull: ['$generatedAt', forecast.generatedAt] },
      forecast.generatedAt,
    ],
  };
  const update = Object.fromEntries(
    Object.entries(fields).map(([field, value]) => [
      field,
      { $cond: [useIncoming, { $literal: value ?? null }, `$${field}`] },
    ]),
  );
  return {
    updateOne: {
      filter: { agentId, spatialKey, timeBucket },
      update: [{ $set: update }],
      upsert: true,
    },
  };
}

@Injectable()
export class MongoPredictionWriter
  extends AbstractPredictionWriter
  implements OnModuleInit
{
  constructor(
    @InjectModel(TrafficForecast.name)
    private readonly forecasts: Model<TrafficForecast>,
    @InjectModel(NodePredictionHistory.name)
    private readonly history: Model<NodePredictionHistory>,
    @InjectModel(NodePredictionLatest.name)
    private readonly legacy: Model<NodePredictionLatest>,
    private readonly topology: AbstractTopologyProvider,
    private readonly buckets: ForecastBucketingService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await Promise.all([
      this.forecasts.init(),
      this.history.init(),
      this.legacy.init(),
    ]);
    const now = Date.now();
    const cutoff = new Date(now - LATEST_PREDICTION_TTL_SECONDS * 1000);
    const cursor = this.legacy
      .find({ updatedAt: { $gt: cutoff } })
      .lean()
      .cursor();
    let nodes: Map<string, InternalNode> | undefined;
    for await (const snapshot of cursor) {
      nodes ??= await this.registeredNodes();
      const {
        nodeId,
        edgeAgentId: agentId,
        currentSpeedRatio,
        confidence,
        observedAt,
      } = snapshot;
      const frames = snapshot.forecasts
        .map(({ horizonMinutes, predictedSpeedRatio }) => ({
          nodeId,
          currentSpeedRatio,
          confidence,
          observedAt,
          predictedSpeedRatio,
          targetTimestamp: this.buckets.requestedTime(
            observedAt,
            horizonMinutes,
          ),
        }))
        .filter(
          ({ targetTimestamp }) =>
            this.buckets
              .expiresAt(this.buckets.timeBucket(targetTimestamp))
              .getTime() > now,
        );
      await this.writeForecasts(
        [{ agentId, generatedAt: observedAt, frames }],
        nodes,
      );
    }
  }

  async store(reports: readonly EdgePredictionReport[]): Promise<void> {
    const nodes = await this.registeredNodes();
    await this.writeForecasts(reports, nodes);

    const measurements = new Map<string, NodePredictionHistory>();
    for (const { agentId, generatedAt, frames } of reports) {
      for (const {
        nodeId,
        currentSpeedRatio,
        confidence,
        observedAt = generatedAt,
      } of frames) {
        if (currentSpeedRatio == null) continue;
        measurements.set(JSON.stringify([nodeId, agentId, observedAt]), {
          nodeId,
          edgeAgentId: agentId,
          timestamp: observedAt,
          speedRatio: currentSpeedRatio,
          confidence: confidence ?? 0,
        });
      }
    }
    for (const measurement of measurements.values()) {
      const { nodeId, edgeAgentId, timestamp } = measurement;
      if (
        !(await this.history.exists({ nodeId, edgeAgentId, timestamp }).exec())
      ) {
        await this.history.create(measurement);
      }
    }
  }

  private async registeredNodes(): Promise<Map<string, InternalNode>> {
    return new Map(
      (await this.topology.getNodes()).map((node) => [node.id, node]),
    );
  }

  private async writeForecasts(
    reports: readonly EdgePredictionReport[],
    nodes: Map<string, InternalNode>,
  ): Promise<void> {
    const newest = new Map<string, TrafficForecast>();
    for (const { agentId, generatedAt, frames } of reports) {
      for (const frame of frames) {
        const { nodeId, targetTimestamp, confidence, currentSpeedRatio } =
          frame;
        const node = nodes.get(nodeId);
        const spatialKey = this.buckets.spatialKey(
          nodeId,
          frame.lat ?? node?.lat,
          frame.lng ?? node?.lon,
        );
        const timeBucket = this.buckets.timeBucket(targetTimestamp);
        const key = JSON.stringify([agentId, spatialKey, timeBucket]);
        const previous = newest.get(key);
        if (previous && previous.generatedAt > generatedAt) continue;

        const speedLimitKmh =
          frame.speedLimitKmh ?? node?.speedLimitKmh ?? DEFAULT_SPEED_LIMIT_KMH;
        newest.set(key, {
          agentId,
          spatialKey,
          timeBucket,
          nodeId,
          targetTimestamp,
          generatedAt,
          speedLimitKmh,
          confidence,
          currentSpeedRatio,
          predictedSpeed:
            frame.predictedSpeed ?? frame.predictedSpeedRatio * speedLimitKmh,
          observedAt:
            frame.observedAt ??
            (currentSpeedRatio == null ? undefined : generatedAt),
          expiresAt: this.buckets.expiresAt(timeBucket),
        });
      }
    }
    const operations = [...newest.values()].map(upsert);
    if (!operations.length) return;
    try {
      await this.forecasts.bulkWrite(operations, { ordered: false });
    } catch (error) {
      if (!(error instanceof mongo.MongoBulkWriteError) || error.err)
        throw error;
      const collisions = Array.isArray(error.writeErrors)
        ? error.writeErrors
        : [error.writeErrors];
      if (!collisions.length || collisions.some(({ code }) => code !== 11000))
        throw error;
      // Concurrent first upserts may collide on the index. The same guarded
      // update can now match the inserted record without losing a newer write.
      await this.forecasts.bulkWrite(
        collisions.map(({ index }) => operations[index]),
        { ordered: false },
      );
    }
  }
}
