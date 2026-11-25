export type EdgeAgentStatus = 'ONLINE' | 'TRAINING' | 'IDLE';

/** Trạng thái một Edge Node/Agent trong mạng Federated Learning */
export interface EdgeAgent {
  id: string;
  name: string;
  region: string;
  device: string;
  status: EdgeAgentStatus;
  managedNodeIds: string[];
  managedNodeCount: number;
  currentRound: number;
  totalRounds: number;
  localLoss: number;
  lastHeartbeat: string; // ISO 8601
}

/** Nguồn trạng thái mạng lưới Edge (tương lai: truy vấn FL Server) */
export abstract class AbstractEdgeRegistryProvider {
  abstract listAgents(): Promise<EdgeAgent[]>;
}
