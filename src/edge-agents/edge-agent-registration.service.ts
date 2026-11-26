import { BadRequestException, Injectable } from '@nestjs/common';
import { parseTargetConfig } from '../common/config/target-config.js';
import {
  buildEdgeId,
  buildGlobalNodeId,
  DEFAULT_GEOMETRY_MODE,
  DEFAULT_SPEED_LIMIT_KMH,
  type EdgeAgentIdentity,
  type InternalEdge,
  type RegisteredNode,
  type RegisteredTopology,
} from '../common/domain/traffic.models.js';
import { AbstractEdgeRegistryProvider } from '../providers/edge-registry/edge-registry.provider.abstract.js';
import { AbstractGeometryProvider } from '../providers/geometry/geometry.provider.abstract.js';

@Injectable()
export class EdgeAgentRegistrationService {
  constructor(
    private readonly registry: AbstractEdgeRegistryProvider,
    private readonly geometry: AbstractGeometryProvider,
  ) {}

  async register(
    agent: EdgeAgentIdentity,
    target: { nodes: unknown; connections: unknown },
  ): Promise<RegisteredTopology> {
    const { config, warnings } = parseTargetConfig(target);
    if (warnings.length > 0) throw new BadRequestException(warnings);
    const entries = Object.entries(config.nodes);
    if (entries.length > 500 || config.connections.length > 2000) {
      throw new BadRequestException(
        'Topology supports at most 500 nodes and 2000 connections',
      );
    }

    const usedIndices = new Set<number>();
    for (const [localId, node] of entries) {
      if (node.index === undefined) continue;
      if (usedIndices.has(node.index))
        throw new BadRequestException(`Duplicate index on node "${localId}"`);
      usedIndices.add(node.index);
    }

    let nextIndex = 0;
    const nodes = new Map<string, RegisteredNode>();
    for (const [localId, node] of entries) {
      while (usedIndices.has(nextIndex)) nextIndex++;
      const index = node.index ?? nextIndex++;
      nodes.set(localId, {
        id: buildGlobalNodeId(agent.agentId, localId),
        localId,
        index,
        name: node.name ?? localId,
        lat: node.lat,
        lon: node.lon,
        speedLimitKmh: node.speed_limit ?? DEFAULT_SPEED_LIMIT_KMH,
        ...(node.polyline ? { polyline: node.polyline } : {}),
      });
    }

    const seen = new Map<string, boolean>();
    const connections = config.connections.map((connection) => {
      const from = nodes.get(connection.from);
      const to = nodes.get(connection.to);
      if (!from || !to || from === to) {
        throw new BadRequestException(
          `Connection ${connection.from} → ${connection.to} must link two distinct registered nodes`,
        );
      }
      const localId = buildEdgeId(connection.from, connection.to);
      const reverse = buildEdgeId(connection.to, connection.from);
      if (
        seen.has(localId) ||
        seen.get(reverse) === false ||
        (!connection.is_one_way && seen.has(reverse))
      ) {
        throw new BadRequestException(
          `Duplicate connection ${connection.from} → ${connection.to}`,
        );
      }
      seen.set(localId, connection.is_one_way);
      const edge: InternalEdge = {
        id: buildGlobalNodeId(agent.agentId, localId),
        fromNodeId: from.id,
        toNodeId: to.id,
        isOneWay: connection.is_one_way,
        geometryMode: connection.geometry_mode ?? DEFAULT_GEOMETRY_MODE,
        manualPolyline: connection.polyline,
      };
      return { edge, from, to };
    });

    const edges = await Promise.all(
      connections.map(async ({ edge, from, to }) => ({
        id: edge.id,
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        isOneWay: edge.isOneWay,
        geometryMode: edge.geometryMode,
        resolvedPolyline: await this.geometry.resolveEdgePolyline(
          edge,
          from,
          to,
        ),
      })),
    );
    const topology = {
      nodes: [...nodes.values()].sort((a, b) => a.index - b.index),
      edges,
    };
    await this.registry.register(agent, topology);
    return topology;
  }
}
