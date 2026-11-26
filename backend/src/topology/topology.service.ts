import { HttpException, Injectable } from '@nestjs/common';
import type { LatLon } from '../common/domain/traffic.models.js';
import { CompositeGeometryProvider } from '../providers/geometry/composite-geometry.provider.js';
import type { PlaceSuggestionDto } from './search-place.dto.js';
import type { ResolvedSegmentDto } from './resolve-segment.dto.js';
import { TomTomService } from './tomtom.service.js';

@Injectable()
export class TopologyService {
  constructor(
    private readonly geometry: CompositeGeometryProvider,
    private readonly tomtom: TomTomService,
  ) {}

  resolveSegment(lat: number, lon: number): Promise<ResolvedSegmentDto> {
    return this.geometry.resolveSegment(lat, lon);
  }

  async resolveNodePolyline(lat: number, lon: number): Promise<LatLon[]> {
    try {
      return (await this.resolveSegment(lat, lon)).polyline;
    } catch (error) {
      if (!(error instanceof HttpException)) throw error;
      return [[lat, lon]];
    }
  }

  searchPlace(query: string): Promise<PlaceSuggestionDto[]> {
    return this.tomtom.searchPlace(query);
  }
}
