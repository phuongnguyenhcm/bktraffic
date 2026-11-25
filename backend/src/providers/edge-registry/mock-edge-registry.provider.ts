import { Injectable } from '@nestjs/common';
import { AbstractTopologyProvider } from '../topology/topology.provider.abstract.js';
import {
  AbstractEdgeRegistryProvider,
  type EdgeAgent,
  type EdgeAgentStatus,
} from './edge-registry.provider.abstract.js';

interface AgentSeed {
  id: string;
  name: string;
  region: string;
  device: string;
  /** null = quản lý toàn bộ topology hiện tại từ target.json */
  managedNodeIds: string[] | null;
}

const SEEDS: AgentSeed[] = [
  { id: 'agent-q10-ltk', name: 'Agent Lý Thường Kiệt', region: 'Quận 10 – TP.HCM', device: 'Raspberry Pi 5 (8GB)', managedNodeIds: null },
  { id: 'agent-q11-ldh', name: 'Agent Lê Đại Hành', region: 'Quận 11 – TP.HCM', device: 'Intel NUC 11', managedNodeIds: ['LDH_1', 'LDH_2', 'LacLongQuan', 'HoaBinh', 'MinhPhung'] },
  { id: 'agent-q5-ntp', name: 'Agent Nguyễn Tri Phương', region: 'Quận 5 – TP.HCM', device: 'Jetson Orin Nano', managedNodeIds: ['NTP_1', 'NTP_2', 'TranHungDao', 'AnDuongVuong'] },
  { id: 'agent-q3-cmt8', name: 'Agent Cách Mạng Tháng 8', region: 'Quận 3 – TP.HCM', device: 'Raspberry Pi 4 (4GB)', managedNodeIds: [] },
];

const TOTAL_ROUNDS = 200;
const ROUND_MS = 45_000;
const STATUS_CYCLE: EdgeAgentStatus[] = ['TRAINING', 'ONLINE', 'TRAINING'];

/** Mock trạng thái mạng lưới FedProx — vòng lặp tăng theo thời gian thực */
@Injectable()
export class MockEdgeRegistryProvider extends AbstractEdgeRegistryProvider {
  constructor(private readonly topology: AbstractTopologyProvider) {
    super();
  }

  async listAgents(): Promise<EdgeAgent[]> {
    const topologyNodeIds = (await this.topology.getNodes()).map((n) => n.id);
    const now = Date.now();
    const baseRound = 100 + (Math.floor(now / ROUND_MS) % (TOTAL_ROUNDS - 100));

    return SEEDS.map((seed, i) => {
      const managedNodeIds = seed.managedNodeIds ?? topologyNodeIds;
      const idle = managedNodeIds.length === 0;
      const status: EdgeAgentStatus = idle ? 'IDLE' : STATUS_CYCLE[(Math.floor(now / 20_000) + i) % STATUS_CYCLE.length];
      const currentRound = idle ? Math.max(0, baseRound - 7) : baseRound - (i % 2);
      return {
        id: seed.id,
        name: seed.name,
        region: seed.region,
        device: seed.device,
        status,
        managedNodeIds,
        managedNodeCount: managedNodeIds.length,
        currentRound,
        totalRounds: TOTAL_ROUNDS,
        localLoss: Math.round((0.08 + 0.55 / Math.sqrt(currentRound + 1) + 0.008 * i) * 1000) / 1000,
        lastHeartbeat: new Date(now - (idle ? 120 : 2 + i * 5) * 1000).toISOString(),
      };
    });
  }
}
