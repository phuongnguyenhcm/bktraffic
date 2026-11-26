import { ConfigService } from '@nestjs/config';
import { expect, it, vi } from 'vitest';
import type { NodePrediction, RegisteredTopology } from '../common/domain/traffic.models.js';
import { ForecastBucketingService } from '../providers/prediction/forecast-bucketing.service.js';
import { TrafficController } from './traffic.controller.js';
import { TrafficService } from './traffic.service.js';

it('returns road geometry and independent node forecasts in GET /api/traffic/map', async () => {
  const targetTimestamp = '2026-11-26T06:40:00.000Z';
  const topology: RegisteredTopology = {
    nodes: [
      {
        id: 'agent-a::first', localId: 'first', index: 0, name: 'First road',
        lat: 10.77, lon: 106.66, speedLimitKmh: 50,
        polyline: [[10.769, 106.66], [10.77, 106.66], [10.771, 106.661]],
      },
      {
        id: 'agent-a::next', localId: 'next', index: 1, name: 'Next road',
        lat: 10.78, lon: 106.67, speedLimitKmh: 40,
      },
    ],
    edges: [{
      id: 'agent-a::first__next', fromNodeId: 'agent-a::first', toNodeId: 'agent-a::next',
      isOneWay: true, geometryMode: 'auto', resolvedPolyline: [[10.77, 106.66], [10.78, 106.67]],
    }],
  };
  const forecast: NodePrediction = {
    nodeId: 'agent-a::first', horizonMinutes: 10, currentSpeedRatio: 0.8,
    predictedSpeedRatio: 0.6, predictedSpeedKmh: 30, confidence: 0.9, status: 'MODERATE',
    timestamp: targetTimestamp, targetTimestamp,
    timeBucket: Date.parse(targetTimestamp), latestGeneratedAt: '2026-11-26T06:30:00.000Z',
  };
  const controller = new TrafficController(new TrafficService(
    { getTopology: vi.fn().mockResolvedValue(topology), getNodes: vi.fn(), getEdges: vi.fn(), getAgents: vi.fn() },
    {
      predictNodes: vi.fn().mockResolvedValue([forecast]),
      predictNode: vi.fn(),
      getNodeHistoryAndForecast: vi.fn(),
    },
    new ForecastBucketingService(new ConfigService()),
  ));

  const map = await controller.getMap({ horizon: 10 });

  expect(map.nodes).toMatchObject([
    {
      id: 'agent-a::first', lat: 10.77, lon: 106.66, polyline: topology.nodes[0].polyline,
      predictedSpeed: 30, speedLimitKmh: 50, speedRatio: 0.6, confidence: 0.9, status: 'MODERATE',
      predictedSpeedKmh: 30, predictedSpeedRatio: 0.6,
      targetTimestamp: forecast.targetTimestamp, timeBucket: forecast.timeBucket,
      latestGeneratedAt: forecast.latestGeneratedAt,
    },
    {
      id: 'agent-a::next', lat: 10.78, lon: 106.67, polyline: [[10.78, 106.67]],
      predictedSpeed: 0, speedLimitKmh: 40, speedRatio: 0, confidence: 0, status: 'UNKNOWN',
    },
  ]);
  expect(map.edges).toMatchObject([{ status: 'UNKNOWN' }]);
  expect(map.summary).toEqual({ clear: 0, moderate: 1, congested: 0 });
});
