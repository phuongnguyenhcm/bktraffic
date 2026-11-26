import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsObject,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { LOCAL_IDENTIFIER_PATTERN } from '../common/domain/traffic.models.js';
import { EdgeAgentRegistrationService } from './edge-agent-registration.service.js';

class RegisterEdgeAgentDto {
  @IsString()
  @Matches(LOCAL_IDENTIFIER_PATTERN)
  agentId: string;

  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  name: string;

  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  region: string;

  @IsObject()
  @Transform(({ obj }: { obj: unknown }) =>
    obj && typeof obj === 'object' && 'nodes' in obj ? obj.nodes : undefined,
  )
  nodes: Record<string, unknown>;

  @IsArray()
  connections: unknown[];
}

@Controller('edge-agents')
export class EdgeAgentsController {
  constructor(private readonly registration: EdgeAgentRegistrationService) {}

  @Post('register')
  @HttpCode(200)
  async register(
    @Body() dto: RegisterEdgeAgentDto,
  ): Promise<{ agentId: string; nodeCount: number; edgeCount: number }> {
    const { agentId, name, region, nodes, connections } = dto;
    const topology = await this.registration.register(
      { agentId, name: name.trim(), region: region.trim() },
      { nodes, connections },
    );
    return {
      agentId,
      nodeCount: topology.nodes.length,
      edgeCount: topology.edges.length,
    };
  }
}
