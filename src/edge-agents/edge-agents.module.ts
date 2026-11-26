import { Module } from '@nestjs/common';
import { EdgeAgentRegistrationService } from './edge-agent-registration.service.js';
import { EdgeAgentsController } from './edge-agents.controller.js';

@Module({
  controllers: [EdgeAgentsController],
  providers: [EdgeAgentRegistrationService],
})
export class EdgeAgentsModule {}
