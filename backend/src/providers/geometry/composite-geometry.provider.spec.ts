import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { InternalEdge, InternalNode } from '../../common/domain/traffic.models.js';
import { CompositeGeometryProvider } from './composite-geometry.provider.js';

const A: InternalNode = { id: 'A', index: 0, name: 'A', lat: 10.78, lon: 106.65, speedLimitKmh: 40 };
const B: InternalNode = { id: 'B', index: 1, name: 'B', lat: 10.77, lon: 106.66, speedLimitKmh: 40 };
const autoEdge: InternalEdge = { id: 'A__B', fromNodeId: 'A', toNodeId: 'B', isOneWay: false, geometryMode: 'auto' };

const osrmOk = {
  code: 'Ok',
  routes: [{ geometry: { type: 'LineString', coordinates: [[106.65, 10.78], [106.655, 10.775], [106.66, 10.77]] } }],
};

describe('CompositeGeometryProvider', () => {
  let dir: string;
  const makeProvider = (): CompositeGeometryProvider =>
    new CompositeGeometryProvider(new ConfigService({ DATA_DIR: dir, OSRM_BASE_URL: 'http://osrm.test', OSRM_TIMEOUT_MS: '1000' }));

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'geo-'));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(dir, { recursive: true, force: true });
  });

  it('returns manual polyline without calling OSRM', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const manual: InternalEdge = { ...autoEdge, geometryMode: 'manual', manualPolyline: [[1, 2], [3, 4]] };
    expect(await makeProvider().resolveEdgePolyline(manual, A, B)).toEqual([[1, 2], [3, 4]]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches OSRM once, swaps [lon,lat] → [lat,lon] and persists cache to file', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify(osrmOk), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = makeProvider();

    const first = await provider.resolveEdgePolyline(autoEdge, A, B);
    const second = await provider.resolveEdgePolyline(autoEdge, A, B);
    expect(first).toEqual([[10.78, 106.65], [10.775, 106.655], [10.77, 106.66]]);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/route/v1/driving/106.65,10.78;106.66,10.77');

    const file = JSON.parse(await readFile(path.join(dir, 'polyline-cache.json'), 'utf8')) as {
      entries: Record<string, { polyline: unknown }>;
    };
    expect(Object.values(file.entries)[0]?.polyline).toEqual(first);

    // Instance mới đọc từ file cache, không gọi OSRM nữa
    const fresh = makeProvider();
    expect(await fresh.resolveEdgePolyline(autoEdge, A, B)).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to a straight line when OSRM fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 503 })));
    const res = await makeProvider().resolveEdgePolyline(autoEdge, A, B);
    expect(res).toEqual([[A.lat, A.lon], [B.lat, B.lon]]);
  });
});
