import { Global, Module } from '@nestjs/common';
import { AbstractTopologyProvider } from './topology/topology.provider.abstract.js';
import { JsonConfigTopologyProvider } from './topology/json-config-topology.provider.js';
import { AbstractPredictionProvider } from './prediction/prediction.provider.abstract.js';
import { SimulatedCsvPredictionProvider } from './prediction/simulated-csv-prediction.provider.js';
import { AbstractGeometryProvider } from './geometry/geometry.provider.abstract.js';
import { CompositeGeometryProvider } from './geometry/composite-geometry.provider.js';
import { AbstractEdgeRegistryProvider } from './edge-registry/edge-registry.provider.abstract.js';
import { MockEdgeRegistryProvider } from './edge-registry/mock-edge-registry.provider.js';

/**
 * Điểm DUY NHẤT gắn Abstract → Concrete (Dependency Inversion).
 * Đổi engine dự báo thật: chỉ cần thay `useClass` của AbstractPredictionProvider,
 * ví dụ `FederatedGrpcPredictionProvider`.
 */
@Global()
@Module({
  providers: [
    { provide: AbstractTopologyProvider, useClass: JsonConfigTopologyProvider },
    { provide: AbstractPredictionProvider, useClass: SimulatedCsvPredictionProvider },
    { provide: AbstractGeometryProvider, useClass: CompositeGeometryProvider },
    { provide: AbstractEdgeRegistryProvider, useClass: MockEdgeRegistryProvider },
  ],
  exports: [
    AbstractTopologyProvider,
    AbstractPredictionProvider,
    AbstractGeometryProvider,
    AbstractEdgeRegistryProvider,
  ],
})
export class ProvidersModule {}
