import type { EdgeAgentSummary, InternalNode, RegisteredTopology, ResolvedEdge } from '../../common/domain/traffic.models.js';

export abstract class AbstractTopologyProvider {
  abstract getTopology(): Promise<RegisteredTopology>;
  abstract getNodes(): Promise<InternalNode[]>;
  abstract getEdges(): Promise<ResolvedEdge[]>;
  abstract getAgents(): Promise<EdgeAgentSummary[]>;
}
