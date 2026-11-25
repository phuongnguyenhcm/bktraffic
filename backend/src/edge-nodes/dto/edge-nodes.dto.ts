import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  registerDecorator,
  ValidateIf,
  ValidateNested,
  type ValidationOptions,
} from 'class-validator';
import type { GeometryMode, LatLon } from '../../common/domain/traffic.models.js';
import { isLatLonArray, type TargetConfigFile } from '../../common/config/target-config.js';
import type { EdgeAgent } from '../../providers/edge-registry/edge-registry.provider.abstract.js';

/** Kiểm tra mảng `[[lat, lon], ...]` hợp lệ với tối thiểu `min` điểm */
function IsLatLonPolyline(min: number, options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isLatLonPolyline',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: {
        message: `$property must be an array of at least ${min} [lat, lon] pairs`,
        ...options,
      },
      validator: {
        validate: (value: unknown) => isLatLonArray(value) && value.length >= min,
      },
    });
  };
}

const NODE_ID_PATTERN = /^[A-Za-z0-9_+\-.]{1,64}$/;

export class ConfigNodeInputDto {
  @IsString()
  @Matches(NODE_ID_PATTERN, { message: 'id may contain letters, digits, _ + - . (max 64)' })
  id: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lon: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(150)
  speedLimitKmh?: number;
}

export class ConfigConnectionInputDto {
  @IsString()
  @Matches(NODE_ID_PATTERN)
  from: string;

  @IsString()
  @Matches(NODE_ID_PATTERN)
  to: string;

  @IsBoolean()
  isOneWay: boolean;

  @IsIn(['auto', 'manual'])
  geometryMode: GeometryMode;

  @ValidateIf((o: ConfigConnectionInputDto) => o.geometryMode === 'manual')
  @IsArray()
  @ArrayMaxSize(2000)
  @IsLatLonPolyline(2)
  polyline?: LatLon[];
}

export class GenerateConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  agentName?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one node is required' })
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ConfigNodeInputDto)
  nodes: ConfigNodeInputDto[];

  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => ConfigConnectionInputDto)
  connections: ConfigConnectionInputDto[];
}

export interface GenerateConfigResponseDto {
  fileName: string;
  config: TargetConfigFile;
  stats: { nodeCount: number; connectionCount: number; manualConnectionCount: number };
}

export type EdgeAgentDto = EdgeAgent;
