import { Controller, Get, Param, Query } from '@nestjs/common';
import { TrafficService } from './traffic.service.js';
import {
  HistoryQueryDto,
  MapQueryDto,
  type NodeHistoryResponseDto,
  type TrafficMapResponseDto,
} from './dto/traffic.dto.js';

@Controller('traffic')
export class TrafficController {
  constructor(private readonly traffic: TrafficService) {}

  /** GET /api/traffic/map?horizon=5|10|30|60 */
  @Get('map')
  getMap(@Query() query: MapQueryDto): Promise<TrafficMapResponseDto> {
    return this.traffic.getMap(query.horizon);
  }

  /** GET /api/traffic/nodes/:id/history?limit=24 */
  @Get('nodes/:id/history')
  getNodeHistory(@Param('id') id: string, @Query() query: HistoryQueryDto): Promise<NodeHistoryResponseDto> {
    return this.traffic.getNodeHistory(id, query.limit);
  }
}
