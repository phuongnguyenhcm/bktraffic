import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { EdgeNodesService } from './edge-nodes.service.js';
import { GenerateConfigDto, type EdgeAgentDto, type GenerateConfigResponseDto } from './dto/edge-nodes.dto.js';
import type { EdgePredictionReport } from '../common/domain/traffic.models.js';
import { EdgePredictionPayloadPipe } from './dto/edge-prediction.dto.js';
import { AbstractPredictionWriter } from '../providers/prediction/prediction-writer.abstract.js';
import { AbstractEdgeRegistryProvider } from '../providers/edge-registry/edge-registry.provider.abstract.js';

@Controller('edge-nodes')
export class EdgeNodesController {
  constructor(
    private readonly service: EdgeNodesService,
    private readonly predictions: AbstractPredictionWriter,
    private readonly registry: AbstractEdgeRegistryProvider,
  ) {}

  /** GET /api/edge-nodes */
  @Get()
  list(): Promise<EdgeAgentDto[]> {
    return this.service.listAgents();
  }

  /** POST /api/edge-nodes/generate-config → nội dung target.json */
  @Post('generate-config')
  @HttpCode(200)
  generateConfig(@Body() dto: GenerateConfigDto): GenerateConfigResponseDto {
    return this.service.generateConfig(dto);
  }

  @Post('predictions')
  @HttpCode(204)
  async ingestPredictions(@Body(EdgePredictionPayloadPipe) reports: EdgePredictionReport[]): Promise<void> {
    await this.predictions.store(reports);
    const agents = new Set(reports.map(({ agentId }) => agentId));
    await Promise.all([...agents].map((agentId) => this.registry.touch(agentId)));
  }
}
