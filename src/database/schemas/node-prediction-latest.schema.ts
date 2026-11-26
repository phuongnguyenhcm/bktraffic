import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import {
  PREDICTION_HORIZONS,
  REPORTED_TRAFFIC_STATUSES,
  type EdgeForecast,
} from '../../common/domain/traffic.models.js';

export const LATEST_PREDICTION_TTL_SECONDS = 900;

const forecastSchema = new MongooseSchema<EdgeForecast>(
  {
    horizonMinutes: { type: Number, enum: PREDICTION_HORIZONS, required: true },
    predictedSpeedRatio: { type: Number, min: 0, max: 1, required: true },
    status: { type: String, enum: REPORTED_TRAFFIC_STATUSES, required: true },
  },
  { _id: false },
);

@Schema({ collection: 'node_predictions_latest', versionKey: false })
export class NodePredictionLatest {
  @Prop({ required: true })
  nodeId: string;

  @Prop({ required: true })
  edgeAgentId: string;

  @Prop({ required: true, min: 0, max: 1 })
  currentSpeedRatio: number;

  @Prop({ required: true, min: 0, max: 1 })
  confidence: number;

  @Prop({ type: [forecastSchema], required: true })
  forecasts: EdgeForecast[];

  @Prop({ required: true })
  observedAt: Date;

  @Prop({ required: true })
  updatedAt: Date;
}

export const NodePredictionLatestSchema =
  SchemaFactory.createForClass(NodePredictionLatest);
NodePredictionLatestSchema.index({ nodeId: 1 }, { unique: true });
NodePredictionLatestSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: LATEST_PREDICTION_TTL_SECONDS },
);
