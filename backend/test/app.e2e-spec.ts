import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { AbstractGeometryProvider } from './../src/providers/geometry/geometry.provider.abstract.js';
import { PREDICTION_HORIZONS, type EdgePredictionReport, type InternalEdge, type InternalNode, type LatLon } from './../src/common/domain/traffic.models.js';
import { NodePredictionHistory } from '../src/database/schemas/node-prediction-history.schema.js';
import { TrafficForecast } from '../src/database/schemas/traffic-forecast.schema.js';
import { NodePredictionLatest } from '../src/database/schemas/node-prediction-latest.schema.js';
import { ForecastBucketingService } from '../src/providers/prediction/forecast-bucketing.service.js';
import { EdgeAgent } from '../src/database/schemas/edge-agent.schema.js';
import { AbstractPredictionWriter } from '../src/providers/prediction/prediction-writer.abstract.js';

/** Stub geometry — chứng minh khả năng hoán đổi provider qua DI và tránh gọi mạng trong test */
const resolvePolyline = vi.fn((edge: InternalEdge, from: InternalNode, to: InternalNode): Promise<LatLon[]> =>
  Promise.resolve(edge.manualPolyline ?? [
      [from.lat, from.lon],
      [to.lat, to.lon],
    ]),
);

class StraightLineGeometry extends AbstractGeometryProvider {
  resolveEdgePolyline(edge: InternalEdge, from: InternalNode, to: InternalNode): Promise<LatLon[]> {
    return resolvePolyline(edge, from, to);
  }
}

describe('Traffic API (e2e)', () => {
  let app: INestApplication<App>;
  let spatialKey: string;
  const store = vi.fn<(reports: readonly EdgePredictionReport[]) => Promise<void>>(() => Promise.resolve());
  const report = {
    nodeId: 'LyThuongKiet+CMT8',
    edgeAgentId: 'test-agent',
    currentSpeedRatio: 0.72,
    confidence: 0.95,
    forecasts: PREDICTION_HORIZONS.map((horizonMinutes) => ({
      horizonMinutes, predictedSpeedRatio: 0.68, status: 'MODERATE' as const,
    })),
    observedAt: '2026-11-26T06:30:00.000Z',
  };
  const globalNodeId = `${report.edgeAgentId}::${report.nodeId}`;
  const targetTimestamp = new Date('2026-11-26T06:40:00.000Z');
  const generatedAt = new Date(report.observedAt);
  let hasMatches = true;
  const agentPayload = {
    agentId: report.edgeAgentId,
    name: 'Agent thử nghiệm',
    region: 'Quận 10',
    nodes: {
      [report.nodeId]: { lat: 10.78, lon: 106.65, index: 0 },
      ToHienThanh: { lat: 10.77, lon: 106.66 },
    },
    connections: [{
      from: report.nodeId, to: 'ToHienThanh', is_one_way: false,
      geometry_mode: 'manual', polyline: [[10.78, 106.65], [10.775, 106.655], [10.77, 106.66]],
    }],
  };
  const agentDocuments = new Map<string, EdgeAgent>();
  const agentModel = {
    init: () => Promise.resolve(),
    find: () => ({
      sort: () => ({ lean: () => ({ exec: () => Promise.resolve([...agentDocuments.values()]) }) }),
    }),
    updateOne: (
      { agentId }: { agentId: string },
      { $set, $max }: { $set?: Pick<EdgeAgent, 'name' | 'region' | 'nodes' | 'edges'>; $max: { lastSeenAt: Date } },
    ) => ({
      exec: () => {
        const previous = agentDocuments.get(agentId);
        const lastSeenAt = previous && previous.lastSeenAt > $max.lastSeenAt ? previous.lastSeenAt : $max.lastSeenAt;
        const topology = $set ?? previous;
        if (topology) agentDocuments.set(agentId, { ...topology, agentId, lastSeenAt });
        return Promise.resolve();
      },
    }),
  };
  const aggregate = vi.fn(() => ({
    exec: () => Promise.resolve(hasMatches ? [{
      _id: spatialKey, predictedSpeed: 27.2, speedLimitKmh: 40, currentSpeedRatio: 0.72,
      confidence: 0.95, targetTimestamp, timeBucket: targetTimestamp.getTime(),
      latestGeneratedAt: generatedAt, observedAt: generatedAt,
    }] : []),
  }));
  const history = {
    find: () => ({
      sort: () => ({
        limit: () => ({
          lean: () => ({
            exec: () => Promise.resolve([
              { timestamp: new Date(report.observedAt), speedRatio: 0.72 },
              { timestamp: new Date('2026-11-26T06:25:00.000Z'), speedRatio: 0.7 },
            ]),
          }),
        }),
      }),
    }),
  };

  beforeAll(async () => {
    vi.stubEnv('MONGODB_URI', 'mongodb://127.0.0.1:27017/traffic_db');
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getConnectionToken()).useValue({ close: () => Promise.resolve() })
      .overrideProvider(getModelToken(EdgeAgent.name)).useValue(agentModel)
      .overrideProvider(getModelToken(TrafficForecast.name)).useValue({ aggregate })
      .overrideProvider(getModelToken(NodePredictionLatest.name)).useValue({})
      .overrideProvider(getModelToken(NodePredictionHistory.name)).useValue(history)
      .overrideProvider(AbstractPredictionWriter).useValue({ store })
      .overrideProvider(AbstractGeometryProvider)
      .useClass(StraightLineGeometry)
      .compile();

    spatialKey = moduleFixture.get(ForecastBucketingService).spatialKey(globalNodeId, 10.78, 106.65);
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    await request(app.getHttpServer()).post('/api/edge-agents/register').send(agentPayload).expect(200);
  });

  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  it('GET /traffic/map?horizon=10 returns nodes and edges with polyline + status', async () => {
    const res = await request(app.getHttpServer()).get('/api/traffic/map?horizon=10').expect(200);
    const body = res.body as {
      horizonMinutes: number;
      nodes: { id: string; index: number; status: string; frc?: unknown }[];
      edges: { polyline: unknown[]; status: string }[];
      summary: { clear: number; moderate: number; congested: number };
    };
    expect(body.horizonMinutes).toBe(10);
    expect(body).toMatchObject({
      targetTimestamp: targetTimestamp.toISOString(),
      timeBucket: targetTimestamp.getTime(),
      latestGeneratedAt: generatedAt.toISOString(),
    });
    expect(body.nodes.length).toBeGreaterThan(0);
    expect(body.edges.length).toBeGreaterThan(0);
    expect(body.edges.every((e) => e.polyline.length >= 2)).toBe(true);
    expect(body.nodes.find((node) => node.id === globalNodeId)).toMatchObject({
      status: 'MODERATE', predictedSpeedKmh: 27.2,
    });
    expect(body.nodes.find((node) => node.id !== globalNodeId)).toMatchObject({
      status: 'UNKNOWN', predictedSpeedRatio: 0, predictedSpeedKmh: 0, confidence: 0,
    });
    expect(body.edges.every((edge) => edge.status === 'UNKNOWN')).toBe(true);
    expect(body.edges[0].polyline).toEqual(agentPayload.connections[0].polyline);
    expect(resolvePolyline).toHaveBeenCalledTimes(1);
    expect(body.summary).toEqual({ clear: 0, moderate: 1, congested: 0 });
    expect(body.nodes.some((n) => 'frc' in n)).toBe(false);
  });

  it('accepts an arbitrary whole-minute horizon and rejects negative horizons', async () => {
    await request(app.getHttpServer()).get('/api/traffic/map?horizon=15').expect(200);
    await request(app.getHttpServer()).get('/api/traffic/map?horizon=-1').expect(400);
  });

  it('returns an empty map and registry when there are no registered agents', async () => {
    const registered = [...agentDocuments.entries()];
    agentDocuments.clear();
    try {
      aggregate.mockClear();
      const map = await request(app.getHttpServer()).get('/api/traffic/map?horizon=10').expect(200);
      expect(map.body).toMatchObject({ nodes: [], edges: [], dataTimestamp: null });
      expect(aggregate).not.toHaveBeenCalled();
      await request(app.getHttpServer()).get('/api/edge-nodes').expect(200, []);
    } finally {
      for (const [id, agent] of registered) agentDocuments.set(id, agent);
    }
  });

  it('namespaces identical local IDs and replaces topology on re-registration', async () => {
    const sendRegistration = (payload: object) => request(app.getHttpServer()).post('/api/edge-agents/register').send(payload);
    try {
      await sendRegistration({ ...agentPayload, agentId: 'another-agent' }).expect(200, {
        agentId: 'another-agent', nodeCount: 2, edgeCount: 1,
      });
      const map = await request(app.getHttpServer()).get('/api/traffic/map?horizon=10').expect(200);
      const body = map.body as { nodes: { id: string }[] };
      expect(body.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
        globalNodeId, `another-agent::${report.nodeId}`,
      ]));
      await sendRegistration({ ...agentPayload, agentId: 'another-agent', connections: [], nodes: {} }).expect(200);
      expect(agentDocuments.get('another-agent')).toMatchObject({ nodes: [], edges: [] });
      await sendRegistration({ ...agentPayload, agentId: 'another-agent', connections: [
        { from: report.nodeId, to: 'unknown', is_one_way: false },
      ] }).expect(400);
      expect(agentDocuments.get('another-agent')).toMatchObject({ nodes: [], edges: [] });
    } finally {
      agentDocuments.delete('another-agent');
    }
  });

  it('reports unknown when there are no forecasts in the matched buckets', async () => {
    hasMatches = false;
    try {
      const res = await request(app.getHttpServer()).get('/api/traffic/map?horizon=10').expect(200);
      const body = res.body as { dataTimestamp: string | null; nodes: { status: string }[] };
      expect(body.dataTimestamp).toBeNull();
      expect(body.nodes.every((node) => node.status === 'UNKNOWN')).toBe(true);
    } finally {
      hasMatches = true;
    }
  });

  it('GET /traffic/nodes/:id/history returns 4 forecasts', async () => {
    const map = await request(app.getHttpServer()).get('/api/traffic/map').expect(200);
    const firstId = (map.body as { nodes: { id: string }[] }).nodes[0].id;
    const res = await request(app.getHttpServer())
      .get(`/api/traffic/nodes/${encodeURIComponent(firstId)}/history`)
      .expect(200);
    const body = res.body as { forecasts: { horizonMinutes: number }[]; history: { timestamp: string }[] };
    expect(body.forecasts.map((f) => f.horizonMinutes)).toEqual([5, 10, 30, 60]);
    expect(body.history.map((sample) => sample.timestamp)).toEqual(['2026-11-26T06:25:00.000Z', report.observedAt]);
  });

  it('accepts a single transform-validated report and a batch, rejecting invalid batches before writing', async () => {
    store.mockClear();
    const sendReports = (payload: object) => request(app.getHttpServer()).post('/api/edge-nodes/predictions').send(payload);
    const agent = agentDocuments.get(report.edgeAgentId);
    if (!agent) throw new Error('Expected registered test agent');
    agent.lastSeenAt = new Date(Date.now() - 16 * 60_000);
    const offline = await request(app.getHttpServer()).get('/api/edge-nodes').expect(200);
    expect(offline.body).toMatchObject([{ agentId: report.edgeAgentId, status: 'OFFLINE', managedNodeCount: 2 }]);
    await sendReports(report).expect(204);
    await sendReports([{ ...report, nodeId: globalNodeId }, { ...report, nodeId: 'ToHienThanh' }]).expect(204);
    expect(store).toHaveBeenCalledTimes(2);
    expect(store).toHaveBeenCalledWith([{
      agentId: report.edgeAgentId, generatedAt,
      frames: report.forecasts.map(({ horizonMinutes, predictedSpeedRatio }) => ({
        nodeId: globalNodeId, currentSpeedRatio: report.currentSpeedRatio,
        confidence: report.confidence, observedAt: generatedAt, predictedSpeedRatio,
        targetTimestamp: new Date(generatedAt.getTime() + horizonMinutes * 60_000),
      })),
    }]);
    const online = await request(app.getHttpServer()).get('/api/edge-nodes').expect(200);
    expect(online.body).toMatchObject([{ agentId: report.edgeAgentId, status: 'ONLINE', managedNodeCount: 2 }]);

    await sendReports([report, { ...report, forecasts: Array.from({ length: 4 }, () => report.forecasts[0]) }]).expect(400);
    await sendReports({ ...report, forecasts: [null, ...report.forecasts.slice(1)] }).expect(400);
    await sendReports({ ...report, observedAt: '2026-11-26T06:30:00' }).expect(400);
    await sendReports({ ...report, nodeId: 'another-agent::ToHienThanh' }).expect(400);
    expect(store).toHaveBeenCalledTimes(2);
  });


  it('accepts a timestamped batch with an irregular forecast cadence', async () => {
    store.mockClear();
    const frames = ['2026-11-26T06:34:27.000Z', '2026-11-26T06:41:36.000Z'].map((targetTimestamp) => ({
      nodeId: report.nodeId, lat: 10.78, lng: 106.65, targetTimestamp, predictedSpeed: 27.2,
    }));
    await request(app.getHttpServer()).post('/api/edge-nodes/predictions').send({
      agentId: report.edgeAgentId, generatedAt: generatedAt.toISOString(), frames,
    }).expect(204);
    expect(store).toHaveBeenCalledWith([{
      agentId: report.edgeAgentId, generatedAt,
      frames: frames.map((frame) => ({
        ...frame, nodeId: globalNodeId, targetTimestamp: new Date(frame.targetTimestamp),
      })),
    }]);
  });

  it('returns 404 for unknown node', () =>
    request(app.getHttpServer()).get('/api/traffic/nodes/unknown/history').expect(404));

  it('POST /edge-nodes/generate-config builds target.json and validates manual polyline', async () => {
    const ok = await request(app.getHttpServer())
      .post('/api/edge-nodes/generate-config')
      .send({
        nodes: [
          { id: 'A', lat: 10.78, lon: 106.65, speedLimitKmh: 50 },
          { id: 'B', lat: 10.77, lon: 106.66 },
        ],
        connections: [{ from: 'A', to: 'B', isOneWay: false, geometryMode: 'manual', polyline: [[10.78, 106.65], [10.77, 106.66]] }],
      })
      .expect(200);
    expect(ok.body).toMatchObject({
      fileName: 'target.json',
      config: {
        nodes: { A: { lat: 10.78, lon: 106.65, speed_limit: 50 }, B: { speed_limit: 40 } },
        connections: [{ from: 'A', to: 'B', is_one_way: false, geometry_mode: 'manual' }],
      },
    });

    await request(app.getHttpServer())
      .post('/api/edge-nodes/generate-config')
      .send({
        nodes: [{ id: 'A', lat: 10.78, lon: 106.65 }, { id: 'B', lat: 10.77, lon: 106.66 }],
        connections: [{ from: 'A', to: 'B', isOneWay: false, geometryMode: 'manual', polyline: [[10.78]] }],
      })
      .expect(400);
  });
});
