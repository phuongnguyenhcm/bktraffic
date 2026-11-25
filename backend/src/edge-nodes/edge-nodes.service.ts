import { BadRequestException, Injectable } from '@nestjs/common';
import { buildEdgeId, DEFAULT_SPEED_LIMIT_KMH } from '../common/domain/traffic.models.js';
import type { TargetConfigConnection, TargetConfigNode } from '../common/config/target-config.js';
import { AbstractEdgeRegistryProvider } from '../providers/edge-registry/edge-registry.provider.abstract.js';
import type { EdgeAgentDto, GenerateConfigDto, GenerateConfigResponseDto } from './dto/edge-nodes.dto.js';

@Injectable()
export class EdgeNodesService {
  constructor(private readonly registry: AbstractEdgeRegistryProvider) {}

  listAgents(): Promise<EdgeAgentDto[]> {
    return this.registry.listAgents();
  }

  /** Sinh nội dung `target.json` chuẩn (cùng cấu trúc với file gốc + trường mở rộng) */
  generateConfig(dto: GenerateConfigDto): GenerateConfigResponseDto {
    const errors: string[] = [];
    const nodes = new Map<string, TargetConfigNode>();

    for (const n of dto.nodes) {
      if (nodes.has(n.id)) errors.push(`Duplicate node id "${n.id}"`);
      nodes.set(n.id, { lat: n.lat, lon: n.lon, speed_limit: n.speedLimitKmh ?? DEFAULT_SPEED_LIMIT_KMH });
    }

    const connections: TargetConfigConnection[] = [];
    const seen = new Map<string, boolean>();
    for (const c of dto.connections) {
      const label = `${c.from} → ${c.to}`;
      if (!nodes.has(c.from) || !nodes.has(c.to)) {
        errors.push(`Connection ${label} references an unknown node`);
        continue;
      }
      if (c.from === c.to) {
        errors.push(`Connection ${label} is a self-loop`);
        continue;
      }
      const key = buildEdgeId(c.from, c.to);
      const reverse = buildEdgeId(c.to, c.from);
      if (seen.has(key) || seen.get(reverse) === false || (!c.isOneWay && seen.has(reverse))) {
        errors.push(`Duplicate connection ${label}`);
        continue;
      }
      seen.set(key, c.isOneWay);

      const conn: TargetConfigConnection = {
        from: c.from,
        to: c.to,
        is_one_way: c.isOneWay,
        geometry_mode: c.geometryMode,
      };
      if (c.geometryMode === 'manual' && c.polyline) conn.polyline = c.polyline;
      connections.push(conn);
    }

    if (errors.length) throw new BadRequestException(errors);

    return {
      fileName: 'target.json',
      config: { nodes: Object.fromEntries(nodes), connections },
      stats: {
        nodeCount: nodes.size,
        connectionCount: connections.length,
        manualConnectionCount: connections.filter((c) => c.geometry_mode === 'manual').length,
      },
    };
  }
}
