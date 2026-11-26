import { Module } from '@nestjs/common';
import { PredictionStorageModule } from '../database/prediction-storage.module.js';
import { AbstractPredictionProvider } from '../providers/prediction/prediction.provider.abstract.js';
import { MongoPredictionProvider } from '../providers/prediction/mongo-prediction.provider.js';
import { TrafficController } from './traffic.controller.js';
import { TrafficService } from './traffic.service.js';

@Module({
  imports: [PredictionStorageModule],
  controllers: [TrafficController],
  providers: [TrafficService, { provide: AbstractPredictionProvider, useClass: MongoPredictionProvider }],
})
export class TrafficModule {}
