import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { LatLon } from '../../common/domain/traffic.models.js';

@Schema({ collection: 'polyline_caches', timestamps: true, versionKey: false })
export class PolylineCache {
  @Prop({ required: true, unique: true })
  cacheKey: string;

  @Prop({ required: true, min: -90, max: 90 })
  lat: number;

  @Prop({ required: true, min: -180, max: 180 })
  lon: number;

  @Prop({ type: [[Number]], required: true })
  polyline: LatLon[];

  @Prop({ type: Number })
  speedLimitKmh?: number;

  @Prop({ type: String })
  frc?: string;

  @Prop({ required: true })
  provider: string;
}

export const PolylineCacheSchema = SchemaFactory.createForClass(PolylineCache);
