import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EdgeAgent, EdgeAgentSchema } from '../database/schemas/edge-agent.schema.js';
import { PolylineCache, PolylineCacheSchema } from '../database/schemas/polyline-cache.schema.js';
import { TomTomService } from '../topology/tomtom.service.js';
import { AbstractTopologyProvider } from './topology/topology.provider.abstract.js';
import { MongoTopologyProvider } from './topology/mongo-topology.provider.js';
import { AbstractGeometryProvider } from './geometry/geometry.provider.abstract.js';
import { CompositeGeometryProvider } from './geometry/composite-geometry.provider.js';
import { AbstractEdgeRegistryProvider } from './edge-registry/edge-registry.provider.abstract.js';

@Global()
@Module({
  imports: [MongooseModule.forFeature([
    { name: EdgeAgent.name, schema: EdgeAgentSchema },
    { name: PolylineCache.name, schema: PolylineCacheSchema },
  ])],
  providers: [
    TomTomService,
    CompositeGeometryProvider,
    { provide: AbstractTopologyProvider, useClass: MongoTopologyProvider },
    { provide: AbstractGeometryProvider, useExisting: CompositeGeometryProvider },
    { provide: AbstractEdgeRegistryProvider, useExisting: AbstractTopologyProvider },
  ],
  exports: [
    TomTomService,
    CompositeGeometryProvider,
    AbstractTopologyProvider,
    AbstractGeometryProvider,
    AbstractEdgeRegistryProvider,
  ],
})
export class ProvidersModule {}
