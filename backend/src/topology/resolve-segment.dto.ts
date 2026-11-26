import { Transform } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';
import type { LatLon } from '../common/domain/traffic.models.js';

function parseCoordinate({ value }: { value: unknown }): number {
  if (typeof value !== 'string' || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) {
    return Number.NaN;
  }
  return Number(value);
}

export class ResolveSegmentQueryDto {
  @Transform(parseCoordinate)
  @IsNumber({}, { message: 'Vĩ độ (lat) phải là số.' })
  @Min(-90, { message: 'Vĩ độ (lat) phải nằm trong khoảng -90 đến 90.' })
  @Max(90, { message: 'Vĩ độ (lat) phải nằm trong khoảng -90 đến 90.' })
  lat: number;

  @Transform(parseCoordinate)
  @IsNumber({}, { message: 'Kinh độ (lon) phải là số.' })
  @Min(-180, { message: 'Kinh độ (lon) phải nằm trong khoảng -180 đến 180.' })
  @Max(180, { message: 'Kinh độ (lon) phải nằm trong khoảng -180 đến 180.' })
  lon: number;
}

export interface ResolvedSegmentDto {
  lat: number;
  lon: number;
  speedLimitKmh: number;
  polyline: LatLon[];
  frc?: string;
}
