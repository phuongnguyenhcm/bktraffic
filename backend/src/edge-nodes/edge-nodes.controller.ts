import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { EdgeNodesService } from './edge-nodes.service.js';
import { GenerateConfigDto, type EdgeAgentDto, type GenerateConfigResponseDto } from './dto/edge-nodes.dto.js';

@Controller('edge-nodes')
export class EdgeNodesController {
  constructor(private readonly service: EdgeNodesService) {}

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
}
