import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AbstractPredictionWriter } from '../providers/prediction/prediction-writer.abstract.js';
import { MongoPredictionWriter } from './mongo-prediction-writer.js';
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
    ]),
  ],
  providers: [
    { provide: AbstractPredictionWriter, useClass: MongoPredictionWriter },
  ],
  exports: [MongooseModule, AbstractPredictionWriter],
})
export class PredictionStorageModule {}
