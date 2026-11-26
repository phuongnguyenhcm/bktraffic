import type { EdgeAgentIdentity, RegisteredTopology } from '../../common/domain/traffic.models.js';

export abstract class AbstractEdgeRegistryProvider {
  abstract register(agent: EdgeAgentIdentity, topology: RegisteredTopology): Promise<void>;
  abstract touch(agentId: string): Promise<void>;
}
