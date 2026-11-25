import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProvidersModule } from './providers/providers.module.js';
import { TrafficModule } from './traffic/traffic.module.js';
import { EdgeNodesModule } from './edge-nodes/edge-nodes.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ProvidersModule,
    TrafficModule,
    EdgeNodesModule,
  ],
})
export class AppModule {}
