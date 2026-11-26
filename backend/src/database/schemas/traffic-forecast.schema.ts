import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ collection: 'traffic_forecasts', versionKey: false })
export class TrafficForecast {
  @Prop({ required: true })
  agentId: string;

  @Prop({ required: true })
  spatialKey: string;

  @Prop({ required: true })
  timeBucket: number;

  @Prop({ required: true })
  targetTimestamp: Date;

  @Prop({ required: true })
  generatedAt: Date;

  @Prop({ required: true })
  nodeId: string;

  @Prop({ required: true })
  predictedSpeed: number;

  @Prop({ required: true })
  speedLimitKmh: number;

  @Prop()
  confidence?: number;

  @Prop()
  currentSpeedRatio?: number;

  @Prop()
  observedAt?: Date;

  @Prop({ required: true })
  expiresAt: Date;
}

export const TrafficForecastSchema =
  SchemaFactory.createForClass(TrafficForecast);
TrafficForecastSchema.index(
  { agentId: 1, spatialKey: 1, timeBucket: 1 },
  { unique: true },
);
TrafficForecastSchema.index({ spatialKey: 1, timeBucket: 1 });
TrafficForecastSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
