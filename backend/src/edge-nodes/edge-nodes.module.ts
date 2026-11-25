import { Module } from '@nestjs/common';
import { EdgeNodesController } from './edge-nodes.controller.js';
import { EdgeNodesService } from './edge-nodes.service.js';

@Module({
  controllers: [EdgeNodesController],
  providers: [EdgeNodesService],
})
export class EdgeNodesModule {}
