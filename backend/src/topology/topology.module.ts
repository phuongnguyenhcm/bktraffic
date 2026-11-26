import { Controller, Get, Module, Query } from '@nestjs/common';
import { ResolveSegmentQueryDto, type ResolvedSegmentDto } from './resolve-segment.dto.js';
import { SearchPlaceQueryDto, type PlaceSuggestionDto } from './search-place.dto.js';
import { TopologyService } from './topology.service.js';

@Controller('topology')
class TopologyController {
  constructor(private readonly topology: TopologyService) {}

  @Get('resolve-segment')
  resolveSegment(@Query() query: ResolveSegmentQueryDto): Promise<ResolvedSegmentDto> {
    return this.topology.resolveSegment(query.lat, query.lon);
  }

  @Get('search-place')
  searchPlace(@Query() query: SearchPlaceQueryDto): Promise<PlaceSuggestionDto[]> {
    return this.topology.searchPlace(query.q);
  }
}

@Module({ controllers: [TopologyController], providers: [TopologyService] })
export class TopologyModule {}
