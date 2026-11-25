import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { AbstractGeometryProvider } from './../src/providers/geometry/geometry.provider.abstract.js';
import type { InternalEdge, InternalNode, LatLon } from './../src/common/domain/traffic.models.js';

/** Stub geometry — chứng minh khả năng hoán đổi provider qua DI và tránh gọi mạng trong test */
class StraightLineGeometry extends AbstractGeometryProvider {
  resolveEdgePolyline(_e: InternalEdge, from: InternalNode, to: InternalNode): Promise<LatLon[]> {
    return Promise.resolve([
      [from.lat, from.lon],
      [to.lat, to.lon],
    ]);
  }
}

describe('Traffic API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AbstractGeometryProvider)
      .useClass(StraightLineGeometry)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /traffic/map?horizon=10 returns nodes and edges with polyline + status', async () => {
    const res = await request(app.getHttpServer()).get('/api/traffic/map?horizon=10').expect(200);
    const body = res.body as {
      horizonMinutes: number;
      nodes: { id: string; index: number; status: string; frc?: unknown }[];
      edges: { polyline: unknown[]; status: string }[];
    };
    expect(body.horizonMinutes).toBe(10);
    expect(body.nodes.length).toBeGreaterThan(0);
    expect(body.edges.length).toBeGreaterThan(0);
    expect(body.edges.every((e) => e.polyline.length >= 2)).toBe(true);
    expect(body.nodes.every((n) => ['CLEAR', 'MODERATE', 'CONGESTED'].includes(n.status))).toBe(true);
    expect(body.nodes.some((n) => 'frc' in n)).toBe(false);
  });

  it('rejects unsupported horizon', () => request(app.getHttpServer()).get('/api/traffic/map?horizon=15').expect(400));

  it('GET /traffic/nodes/:id/history returns 4 forecasts', async () => {
    const map = await request(app.getHttpServer()).get('/api/traffic/map').expect(200);
    const firstId = (map.body as { nodes: { id: string }[] }).nodes[0].id;
    const res = await request(app.getHttpServer())
      .get(`/api/traffic/nodes/${encodeURIComponent(firstId)}/history`)
      .expect(200);
    const body = res.body as { forecasts: { horizonMinutes: number }[]; history: unknown[] };
    expect(body.forecasts.map((f) => f.horizonMinutes)).toEqual([5, 10, 30, 60]);
    expect(body.history.length).toBeGreaterThan(0);
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
