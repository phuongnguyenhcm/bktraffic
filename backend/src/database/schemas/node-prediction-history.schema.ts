import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export const HISTORY_RETENTION_SECONDS = 1_209_600;

@Schema({
  collection: 'node_predictions_history',
  timeseries: {
    timeField: 'timestamp',
    metaField: 'nodeId',
    granularity: 'minutes',
  },
  expireAfterSeconds: HISTORY_RETENTION_SECONDS,
  versionKey: false,
})
export class NodePredictionHistory {
  @Prop({ required: true })
  nodeId: string;

  @Prop({ required: true })
  edgeAgentId: string;

  @Prop({ required: true, min: 0, max: 1 })
  speedRatio: number;

  @Prop({ required: true, min: 0, max: 1 })
  confidence: number;

  @Prop({ required: true })
  timestamp: Date;
}

export const NodePredictionHistorySchema = SchemaFactory.createForClass(
  NodePredictionHistory,
);
