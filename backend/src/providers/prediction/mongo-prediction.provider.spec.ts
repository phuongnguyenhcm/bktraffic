import { ConfigService } from '@nestjs/config';
import type { Model, PipelineStage } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import type { InternalNode } from '../../common/domain/traffic.models.js';
import type { NodePredictionHistory } from '../../database/schemas/node-prediction-history.schema.js';
import type { TrafficForecast } from '../../database/schemas/traffic-forecast.schema.js';
import { ForecastBucketingService } from './forecast-bucketing.service.js';
import { MongoPredictionProvider } from './mongo-prediction.provider.js';

describe('MongoPredictionProvider', () => {
  it('selects one frame per agent before averaging and returns the matched times', async () => {
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
    const overlapping = { ...node, id: 'agent-b::point', speedLimitKmh: 30 };
    const unrelated = { ...node, id: 'agent-c::point', lon: 106.71 };
    const now = new Date('2026-11-26T06:30:00Z');
    const target = new Date('2026-11-26T06:37:25Z');
    const latest = new Date('2026-11-26T06:30:15Z');
    const timeBucket = buckets.timeBucket(target);
    const spatialKey = buckets.spatialKey(node.id, node.lat, node.lon);
    const aggregate = vi.fn((_pipeline: PipelineStage[]) => ({
      exec: async () => [
        {
          _id: spatialKey,
          predictedSpeed: 24,
          speedLimitKmh: 40,
          currentSpeedRatio: null,
          confidence: 0.8,
          targetTimestamp: target,
          timeBucket,
          latestGeneratedAt: latest,
          observedAt: null,
        },
      ],
    }));
    const provider = new MongoPredictionProvider(
      { aggregate } as unknown as Model<TrafficForecast>,
      {} as Model<NodePredictionHistory>,
      buckets,
    );

    const [first, second, third] = await provider.predictNodes(
      [node, overlapping, unrelated],
      7,
      now,
    );
    expect(aggregate).toHaveBeenCalledTimes(1);
    const [pipeline] = aggregate.mock.calls[0];
    expect(pipeline[0]).toMatchObject({
      $match: {
        spatialKey: { $in: expect.arrayContaining([spatialKey]) },
        ...buckets.matchWindow(buckets.requestedTime(now, 7)),
      },
    });
    expect(pipeline.filter((stage) => '$group' in stage)).toMatchObject([
      {
        $group: {
          _id: { spatialKey: '$spatialKey', agentId: '$agentId' },
          nearest: { $first: '$$ROOT' },
        },
      },
      {
        $group: {
          _id: '$spatialKey',
          predictedSpeed: { $avg: '$predictedSpeed' },
          latestGeneratedAt: { $max: '$generatedAt' },
        },
      },
    ]);
    const expected = {
      predictedSpeedKmh: 24,
      predictedSpeedRatio: 0.6,
      status: 'MODERATE',
      targetTimestamp: target.toISOString(),
      timeBucket,
      latestGeneratedAt: latest.toISOString(),
    };
    expect(first).toMatchObject(expected);
    expect(second).toMatchObject(expected);
    expect(third).toMatchObject({
      status: 'UNKNOWN',
      targetTimestamp: null,
      timeBucket: null,
      latestGeneratedAt: null,
    });
  });
});
