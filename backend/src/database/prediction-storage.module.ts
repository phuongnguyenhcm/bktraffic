import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AbstractPredictionWriter } from '../providers/prediction/prediction-writer.abstract.js';
import { MongoPredictionWriter } from './mongo-prediction-writer.js';
import { ForecastBucketingService } from '../providers/prediction/forecast-bucketing.service.js';
import { TrafficForecast, TrafficForecastSchema } from './schemas/traffic-forecast.schema.js';
import {
  NodePredictionHistory,
  NodePredictionHistorySchema,
} from './schemas/node-prediction-history.schema.js';
import {
  NodePredictionLatest,
  NodePredictionLatestSchema,
} from './schemas/node-prediction-latest.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NodePredictionLatest.name, schema: NodePredictionLatestSchema },
      { name: NodePredictionHistory.name, schema: NodePredictionHistorySchema },
      { name: TrafficForecast.name, schema: TrafficForecastSchema },
    ]),
  ],
  providers: [
    ForecastBucketingService,
    { provide: AbstractPredictionWriter, useClass: MongoPredictionWriter },
  ],
  exports: [MongooseModule, AbstractPredictionWriter, ForecastBucketingService],
})
export class PredictionStorageModule {}
