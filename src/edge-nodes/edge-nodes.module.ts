import { Module } from '@nestjs/common';
import { PredictionStorageModule } from '../database/prediction-storage.module.js';
import { EdgeNodesController } from './edge-nodes.controller.js';
import { EdgeNodesService } from './edge-nodes.service.js';

@Module({
  imports: [PredictionStorageModule],
  controllers: [EdgeNodesController],
  providers: [EdgeNodesService],
})
export class EdgeNodesModule {}
