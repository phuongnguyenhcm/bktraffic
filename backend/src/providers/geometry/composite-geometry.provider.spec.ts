import { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InternalEdge, InternalNode, LatLon } from '../../common/domain/traffic.models.js';
import type { PolylineCache } from '../../database/schemas/polyline-cache.schema.js';
import { TomTomService } from '../../topology/tomtom.service.js';
import { CompositeGeometryProvider } from './composite-geometry.provider.js';

const A: InternalNode = { id: 'A', index: 0, name: 'A', lat: 10.78, lon: 106.65, speedLimitKmh: 40 };
const B: InternalNode = { id: 'B', index: 1, name: 'B', lat: 10.77, lon: 106.66, speedLimitKmh: 40 };
const autoEdge: InternalEdge = { id: 'A__B', fromNodeId: 'A', toNodeId: 'B', isOneWay: false, geometryMode: 'auto' };
const polyline: LatLon[] = [[10.78, 106.65], [10.775, 106.655], [10.77, 106.66]];
const segmentKey = 'tomtom-flow:10.780000,106.650000';
const routeKey = 'osrm:10.780000,106.650000->10.770000,106.660000';
const segment = { lat: 10.775, lon: 106.655, polyline, speedLimitKmh: 55, frc: 'FRC3' };
const flowSegmentData = {
  coordinates: { coordinate: polyline.map(([latitude, longitude]) => ({ latitude, longitude })) },
  freeFlowSpeed: segment.speedLimitKmh,
  frc: segment.frc,
};

function setup(entries: PolylineCache[] = []) {
  const rows = new Map(entries.map((entry) => [entry.cacheKey, entry]));
  const findOne = vi.fn(({ cacheKey }: { cacheKey: string }) => ({
    lean: () => ({ exec: async () => rows.get(cacheKey) ?? null }),
  }));
  const updateOne = vi.fn(({ cacheKey }: { cacheKey: string }, { $set }: { $set: Omit<PolylineCache, 'cacheKey'> }) => ({
    exec: async () => { rows.set(cacheKey, { cacheKey, ...$set }); },
  }));
  const cache = { findOne, updateOne } as unknown as Model<PolylineCache>;
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
  const makeProvider = () => {
    const config = new ConfigService({ OSRM_BASE_URL: 'http://osrm.test', TOMTOM_API_KEY: 'test-key' });
    return new CompositeGeometryProvider(config, cache, new TomTomService(config));
  };
  return { makeProvider, findOne, updateOne, fetchMock };
}

describe('CompositeGeometryProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns manual edge geometry without reading MongoDB or calling OSRM', async () => {
    const { makeProvider, findOne, fetchMock } = setup();
    const manual: InternalEdge = { ...autoEdge, geometryMode: 'manual', manualPolyline: polyline };

    expect(await makeProvider().resolveEdgePolyline(manual, A, B)).toEqual(polyline);
    expect(findOne).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns TomTom geometry and metadata from MongoDB on a normalized cache hit', async () => {
    const { makeProvider, findOne, updateOne, fetchMock } = setup([
      { cacheKey: segmentKey, provider: 'tomtom-flow', ...segment },
    ]);

    expect(await makeProvider().resolveSegment(A.lat + 0.0000001, A.lon)).toEqual(segment);
    expect(findOne).toHaveBeenCalledWith({ cacheKey: segmentKey });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('shares a concurrent TomTom miss, upserts the result, and reuses it from a new instance', async () => {
    const { makeProvider, findOne, updateOne, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(Response.json({ flowSegmentData }));
    const provider = makeProvider();

    expect(await Promise.all([
      provider.resolveSegment(A.lat, A.lon),
      provider.resolveSegment(A.lat, A.lon),
    ])).toEqual([segment, segment]);
    expect(findOne).toHaveBeenCalledTimes(1);
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('point')).toBe('10.78,106.65');
    expect(updateOne).toHaveBeenCalledExactlyOnceWith(
      { cacheKey: segmentKey },
      { $set: { provider: 'tomtom-flow', ...segment } },
      { upsert: true },
    );

    expect(await makeProvider().resolveSegment(A.lat, A.lon)).toEqual(segment);
    expect(findOne).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries failed TomTom resolutions without caching the failure', async () => {
    const { makeProvider, updateOne, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    fetchMock.mockResolvedValueOnce(Response.json({ flowSegmentData }));
    const provider = makeProvider();

    await expect(provider.resolveSegment(A.lat, A.lon)).rejects.toMatchObject({ status: 503 });
    expect(updateOne).not.toHaveBeenCalled();
    expect(await provider.resolveSegment(A.lat, A.lon)).toEqual(segment);
    expect(updateOne).toHaveBeenCalledTimes(1);
  });

  it('upserts OSRM routes under a directional key and reuses them from MongoDB', async () => {
    const { makeProvider, updateOne, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(Response.json({
      code: 'Ok',
      routes: [{ geometry: { coordinates: polyline.map(([lat, lon]) => [lon, lat]) } }],
    }));

    expect(await makeProvider().resolveEdgePolyline(autoEdge, A, B)).toEqual(polyline);
    expect(await makeProvider().resolveEdgePolyline(autoEdge, A, B)).toEqual(polyline);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/route/v1/driving/106.65,10.78;106.66,10.77');
    expect(updateOne).toHaveBeenCalledExactlyOnceWith(
      { cacheKey: routeKey },
      { $set: { provider: 'osrm', lat: A.lat, lon: A.lon, polyline } },
      { upsert: true },
    );
  });

  it('falls back to a straight line without caching it when OSRM fails', async () => {
    const { makeProvider, updateOne, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    const provider = makeProvider();

    expect(await provider.resolveEdgePolyline(autoEdge, A, B)).toEqual([[A.lat, A.lon], [B.lat, B.lon]]);
    expect(await provider.resolveEdgePolyline(autoEdge, A, B)).toEqual([[A.lat, A.lon], [B.lat, B.lon]]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updateOne).not.toHaveBeenCalled();
  });
});
