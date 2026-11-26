import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import type {
  RegisteredNode,
  ResolvedEdge,
} from '../../common/domain/traffic.models.js';

const nodeSchema = new MongooseSchema<RegisteredNode>(
  {
    id: { type: String, required: true },
    localId: { type: String, required: true },
    index: { type: Number, required: true },
    name: { type: String, required: true },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lon: { type: Number, required: true, min: -180, max: 180 },
    speedLimitKmh: { type: Number, required: true },
    polyline: { type: [[Number]], default: undefined },
  },
  { _id: false },
);

const edgeSchema = new MongooseSchema<ResolvedEdge>(
  {
    id: { type: String, required: true },
    fromNodeId: { type: String, required: true },
    toNodeId: { type: String, required: true },
    isOneWay: { type: Boolean, required: true },
    geometryMode: { type: String, enum: ['auto', 'manual'], required: true },
    resolvedPolyline: { type: [[Number]], required: true },
  },
  { _id: false },
);

@Schema({ collection: 'edge_agents', versionKey: false })
export class EdgeAgent {
  @Prop({ required: true })
  agentId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  region: string;

  @Prop({ required: true })
  lastSeenAt: Date;

  @Prop({ type: [nodeSchema], required: true })
  nodes: RegisteredNode[];

  @Prop({ type: [edgeSchema], required: true })
  edges: ResolvedEdge[];
}

export const EdgeAgentSchema = SchemaFactory.createForClass(EdgeAgent);
EdgeAgentSchema.index({ agentId: 1 }, { unique: true });
