import { ConfigService } from '@nestjs/config';
import type { Model } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LatLon } from '../common/domain/traffic.models.js';
import type { EdgeAgent } from '../database/schemas/edge-agent.schema.js';
import type { PolylineCache } from '../database/schemas/polyline-cache.schema.js';
import { CompositeGeometryProvider } from '../providers/geometry/composite-geometry.provider.js';
import { MongoTopologyProvider } from '../providers/topology/mongo-topology.provider.js';
import { TomTomService } from '../topology/tomtom.service.js';
import { TopologyService } from '../topology/topology.service.js';
import { EdgeAgentRegistrationService } from './edge-agent-registration.service.js';

const agent = { agentId: 'agent-a', name: 'Agent A', region: 'HCMC' };
const anchor = { lat: 10.77, lon: 106.66 };
const polyline: LatLon[] = [[10.769, 106.66], [10.77, 106.66], [10.771, 106.661]];

function setup(apiKey?: string) {
  const config = new ConfigService({
    OSRM_BASE_URL: 'http://osrm.test',
    TOMTOM_API_KEY: apiKey ?? 'your_tomtom_api_key',
  });
  const updateOne = vi.fn(() => ({ exec: async () => undefined }));
  const registry = new MongoTopologyProvider({ updateOne } as unknown as Model<EdgeAgent>);
  const cache = {
    findOne: vi.fn(() => ({ lean: () => ({ exec: async () => null }) })),
    updateOne: vi.fn(() => ({ exec: async () => undefined })),
  } as unknown as Model<PolylineCache>;
  const tomtom = new TomTomService(config);
  const geometry = new CompositeGeometryProvider(config, cache, tomtom);
  const service = new EdgeAgentRegistrationService(
    registry,
    { resolveEdgePolyline: vi.fn() },
    new TopologyService(geometry, tomtom),
  );
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
  return { service, updateOne, fetchMock };
}

describe('EdgeAgentRegistrationService node geometry', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stores manual geometry and resolves both explicit and default auto geometry', async () => {
    const { service, updateOne, fetchMock } = setup('test-key');
    const coordinates = polyline.map(([latitude, longitude]) => ({ latitude, longitude }));
    fetchMock.mockImplementation(async () => Response.json({
      flowSegmentData: { coordinates: { coordinate: coordinates } },
    }));
    const manualPolyline: LatLon[] = [[10.76, 106.65], [10.761, 106.651]];

    await service.register(agent, {
      nodes: {
        manual: { ...anchor, geometry_mode: 'manual', polyline: manualPolyline },
        auto: { ...anchor, geometry_mode: 'auto', speed_limit: 50 },
        default: { lat: 10.78, lon: 106.67 },
      },
      connections: [],
    });

    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).searchParams.get('point')))
      .toEqual(['10.77,106.66', '10.78,106.67']);
    expect(updateOne).toHaveBeenCalledWith({ agentId: agent.agentId }, expect.objectContaining({
      $set: expect.objectContaining({ nodes: [
        expect.objectContaining({ localId: 'manual', polyline: manualPolyline }),
        expect.objectContaining({ localId: 'auto', ...anchor, speedLimitKmh: 50, polyline }),
        expect.objectContaining({ localId: 'default', polyline }),
      ] }),
    }), { upsert: true });
  });

  it.each([[undefined, 0], ['test-key', 1]] as const)(
    'stores the centroid when TomTom is unconfigured or unavailable (key %s)',
    async (apiKey, expectedRequests) => {
      const { service, updateOne, fetchMock } = setup(apiKey);
      fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

      const topology = await service.register(agent, { nodes: { road: anchor }, connections: [] });

      expect(fetchMock).toHaveBeenCalledTimes(expectedRequests);
      expect(topology.nodes[0].polyline).toEqual([[anchor.lat, anchor.lon]]);
      expect(updateOne).toHaveBeenCalledWith({ agentId: agent.agentId }, expect.objectContaining({
        $set: expect.objectContaining({ nodes: topology.nodes }),
      }), { upsert: true });
    },
  );

  it('requires a polyline for a node explicitly configured as manual', async () => {
    const { service, updateOne, fetchMock } = setup('test-key');

    await expect(service.register(agent, {
      nodes: { road: { ...anchor, geometry_mode: 'manual' } },
      connections: [],
    })).rejects.toMatchObject({ response: { message: ['Node "road" requires a manual polyline'] } });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
  });
});
