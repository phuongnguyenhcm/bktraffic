import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ProvidersModule } from './providers/providers.module.js';
import { TrafficModule } from './traffic/traffic.module.js';
import { EdgeNodesModule } from './edge-nodes/edge-nodes.module.js';
import { EdgeAgentsModule } from './edge-agents/edge-agents.module.js';
import { TopologyModule } from './topology/topology.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('MONGODB_URI')?.trim() || config.get<string>('MONGO_URI')?.trim();
        if (!uri) throw new Error('MONGODB_URI is required');
        return { uri, dbName: 'traffic_db', serverSelectionTimeoutMS: 10_000, retryAttempts: 2 };
      },
    }),
    ProvidersModule,
    TrafficModule,
    EdgeNodesModule,
    EdgeAgentsModule,
    TopologyModule,
  ],
})
export class AppModule {}
