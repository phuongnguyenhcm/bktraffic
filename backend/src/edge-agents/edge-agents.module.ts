import { Module } from '@nestjs/common';
import { TopologyModule } from '../topology/topology.module.js';
import { EdgeAgentRegistrationService } from './edge-agent-registration.service.js';
import { EdgeAgentsController } from './edge-agents.controller.js';

@Module({
  imports: [TopologyModule],
  controllers: [EdgeAgentsController],
  providers: [EdgeAgentRegistrationService],
})
export class EdgeAgentsModule {}
