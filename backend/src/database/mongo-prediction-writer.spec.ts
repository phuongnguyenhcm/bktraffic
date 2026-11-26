import { ConfigService } from '@nestjs/config';
import type { AnyBulkWriteOperation, Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import type {
  EdgePredictionReport,
  InternalNode,
} from '../common/domain/traffic.models.js';
import { ForecastBucketingService } from '../providers/prediction/forecast-bucketing.service.js';
import type { AbstractTopologyProvider } from '../providers/topology/topology.provider.abstract.js';
import { MongoPredictionWriter } from './mongo-prediction-writer.js';
import type { NodePredictionHistory } from './schemas/node-prediction-history.schema.js';
import type { NodePredictionLatest } from './schemas/node-prediction-latest.schema.js';
import type { TrafficForecast } from './schemas/traffic-forecast.schema.js';

describe('MongoPredictionWriter', () => {
  it('writes one guarded upsert per agent, location and bucket', async () => {
    const config = new ConfigService();
    vi.spyOn(config, 'get').mockReturnValue(undefined);
    const buckets = new ForecastBucketingService(config);
    const node: InternalNode = {
      id: 'agent-a::point',
      index: 0,
      name: 'Point',
      lat: 10.78,
      lon: 106.65,
      speedLimitKmh: 50,
    };
    const bulkWrite =
      vi.fn<
        (
          operations: AnyBulkWriteOperation<TrafficForecast>[],
          options: { ordered: boolean },
        ) => Promise<void>
      >();
    const writer = new MongoPredictionWriter(
      { bulkWrite } as unknown as Model<TrafficForecast>,
      {} as Model<NodePredictionHistory>,
      {} as Model<NodePredictionLatest>,
      { getNodes: async () => [node] } as AbstractTopologyProvider,
      buckets,
    );

    const newer = new Date('2026-11-26T06:30:10Z');
    const older = new Date('2026-11-26T06:30:00Z');
    const firstTarget = new Date('2026-11-26T06:37:20Z');
    const secondTarget = new Date('2026-11-26T06:37:45Z');
    const laterTarget = new Date('2026-11-26T06:38:00Z');
    const batch: EdgePredictionReport[] = [
      {
        agentId: 'agent-a',
        generatedAt: newer,
        frames: [
          {
            nodeId: node.id,
            targetTimestamp: firstTarget,
            predictedSpeedRatio: 0.6,
          },
          { nodeId: node.id, targetTimestamp: laterTarget, predictedSpeed: 42 },
        ],
      },
      {
        agentId: 'agent-a',
        generatedAt: older,
        frames: [
          {
            nodeId: node.id,
            targetTimestamp: secondTarget,
            predictedSpeed: 18,
          },
        ],
      },
      {
        agentId: 'agent-b',
        generatedAt: newer,
        frames: [
          {
            nodeId: 'agent-b::point',
            lat: node.lat,
            lng: node.lon,
            targetTimestamp: secondTarget,
            predictedSpeed: 28,
          },
          {
            nodeId: 'agent-b::unknown',
            targetTimestamp: secondTarget,
            predictedSpeed: 25,
          },
        ],
      },
    ];
    await writer.store(batch);

    expect(bulkWrite).toHaveBeenCalledTimes(1);
    const [ops, options] = bulkWrite.mock.calls[0];
    const spatialKey = buckets.spatialKey(node.id, node.lat, node.lon);
    expect(options).toEqual({ ordered: false });
    expect(ops).toHaveLength(4);
    const freshness = { $lte: [{ $ifNull: ['$generatedAt', newer] }, newer] };
    expect(ops[0]).toMatchObject({
      updateOne: {
        filter: {
          agentId: 'agent-a',
          spatialKey,
          timeBucket: buckets.timeBucket(firstTarget),
        },
        upsert: true,
        update: [
          {
            $set: {
              targetTimestamp: {
                $cond: [
                  freshness,
                  { $literal: firstTarget },
                  '$targetTimestamp',
                ],
              },
              predictedSpeed: {
                $cond: [freshness, { $literal: 30 }, '$predictedSpeed'],
              },
            },
          },
        ],
      },
    });
    expect(ops[1]).toMatchObject({
      updateOne: { filter: { timeBucket: buckets.timeBucket(laterTarget) } },
    });
    expect(ops[2]).toMatchObject({
      updateOne: { filter: { agentId: 'agent-b', spatialKey } },
    });
    expect(ops[3]).toMatchObject({
      updateOne: { filter: { spatialKey: 'agent-b::unknown' } },
    });
  });
});
