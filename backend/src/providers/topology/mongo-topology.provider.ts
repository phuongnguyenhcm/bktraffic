import { Injectable, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { mongo, type Model } from 'mongoose';
import {
  EDGE_AGENT_ONLINE_WINDOW_MS,
  type EdgeAgentIdentity,
  type EdgeAgentSummary,
  type RegisteredNode,
  type RegisteredTopology,
  type ResolvedEdge,
} from '../../common/domain/traffic.models.js';
import { EdgeAgent } from '../../database/schemas/edge-agent.schema.js';
import type { AbstractEdgeRegistryProvider } from '../edge-registry/edge-registry.provider.abstract.js';
import { AbstractTopologyProvider } from './topology.provider.abstract.js';

@Injectable()
export class MongoTopologyProvider
  extends AbstractTopologyProvider
  implements AbstractEdgeRegistryProvider, OnModuleInit
{
  constructor(
    @InjectModel(EdgeAgent.name) private readonly agents: Model<EdgeAgent>,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.agents.init();
  }

  async getTopology(): Promise<RegisteredTopology> {
    const agents = await this.agents
      .find({}, 'nodes edges')
      .sort({ agentId: 1 })
      .lean()
      .exec();
    return {
      nodes: agents.flatMap((agent) => agent.nodes),
      edges: agents.flatMap((agent) => agent.edges),
    };
  }

  async getNodes(): Promise<RegisteredNode[]> {
    const agents = await this.agents
      .find({}, 'nodes')
      .sort({ agentId: 1 })
      .lean()
      .exec();
    return agents.flatMap((agent) => agent.nodes);
  }

  async getEdges(): Promise<ResolvedEdge[]> {
    const agents = await this.agents
      .find({}, 'edges')
      .sort({ agentId: 1 })
      .lean()
      .exec();
    return agents.flatMap((agent) => agent.edges);
  }

  async getAgents(): Promise<EdgeAgentSummary[]> {
    const agents = await this.agents
      .find({}, 'agentId name region lastSeenAt nodes.id')
      .sort({ agentId: 1 })
      .lean()
      .exec();
    const onlineSince = Date.now() - EDGE_AGENT_ONLINE_WINDOW_MS;
    return agents.map(({ agentId, name, region, lastSeenAt, nodes }) => ({
      id: agentId,
      agentId,
      name,
      region,
      lastSeenAt: lastSeenAt.toISOString(),
      lastHeartbeat: lastSeenAt.toISOString(),
      managedNodeIds: nodes.map(({ id }) => id),
      managedNodeCount: nodes.length,
      status: lastSeenAt.getTime() >= onlineSince ? 'ONLINE' : 'OFFLINE',
    }));
  }

  async register(
    agent: EdgeAgentIdentity,
    topology: RegisteredTopology,
  ): Promise<void> {
    const { agentId, name, region } = agent;
    const filter = { agentId };
    const update = {
      $set: { name, region, nodes: topology.nodes, edges: topology.edges },
      $max: { lastSeenAt: new Date() },
    };
    try {
      await this.agents.updateOne(filter, update, { upsert: true }).exec();
    } catch (error) {
      if (!(error instanceof mongo.MongoServerError) || error.code !== 11000)
        throw error;
      await this.agents.updateOne(filter, update).exec();
    }
  }

  async touch(agentId: string): Promise<void> {
    await this.agents
      .updateOne({ agentId }, { $max: { lastSeenAt: new Date() } })
      .exec();
  }
}
