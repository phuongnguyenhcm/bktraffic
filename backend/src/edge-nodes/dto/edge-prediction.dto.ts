import {
  BadRequestException,
  Injectable,
  ValidationPipe,
  type PipeTransform,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  buildGlobalNodeId,
  classifyTrafficStatus,
  LOCAL_IDENTIFIER_PATTERN,
  MAX_FORECAST_HORIZON_MINUTES,
  PREDICTION_NODE_ID_PATTERN,
  REPORTED_TRAFFIC_STATUSES,
  type EdgeForecast,
  type EdgePredictionReport,
} from '../../common/domain/traffic.models.js';
import { ForecastBucketingService } from '../../providers/prediction/forecast-bucketing.service.js';

const TIMEZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

class ForecastFrameDto {
  @IsString()
  @Matches(PREDICTION_NODE_ID_PATTERN)
  nodeId: string;

  @IsOptional()
  @IsLatitude()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  @IsNumber()
  lng?: number;

  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(TIMEZONE)
  targetTimestamp: string;

  @IsNumber()
  @Min(0)
  predictedSpeed: number;

  @IsOptional()
  @IsNumber()
  @Min(Number.EPSILON)
  speedLimitKmh?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  currentSpeedRatio?: number;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(TIMEZONE)
  observedAt?: string;
}

class ForecastBatchDto {
  @IsString()
  @Matches(LOCAL_IDENTIFIER_PATTERN)
  agentId: string;

  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(TIMEZONE)
  generatedAt: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ForecastFrameDto)
  frames: ForecastFrameDto[];
}

class LegacyForecastDto implements EdgeForecast {
  @IsInt()
  @Min(0)
  @Max(MAX_FORECAST_HORIZON_MINUTES)
  horizonMinutes: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  predictedSpeedRatio: number;

  @IsIn(REPORTED_TRAFFIC_STATUSES)
  status: EdgeForecast['status'];
}

class LegacyPredictionDto {
  @IsString()
  @Matches(PREDICTION_NODE_ID_PATTERN)
  nodeId: string;

  @IsString()
  @Matches(LOCAL_IDENTIFIER_PATTERN)
  edgeAgentId: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  currentSpeedRatio: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((forecast: LegacyForecastDto | null) => forecast?.horizonMinutes)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => LegacyForecastDto)
  forecasts: LegacyForecastDto[];

  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(TIMEZONE)
  observedAt: string;
}

function timestamp(value: string | Date, field: string): Date {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new BadRequestException(`${field} must be a valid timestamp`);
  }
  return date;
}

function ownedNodeId(agentId: string, nodeId: string): string {
  if (!nodeId.includes('::')) return buildGlobalNodeId(agentId, nodeId);
  if (nodeId.startsWith(`${agentId}::`)) return nodeId;
  throw new BadRequestException('nodeId must belong to the reporting agent');
}

@Injectable()
export class EdgePredictionPayloadPipe implements PipeTransform<
  unknown,
  Promise<EdgePredictionReport[]>
> {
  private readonly validation = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  constructor(private readonly buckets: ForecastBucketingService) {}

  async transform(body: unknown): Promise<EdgePredictionReport[]> {
    const batch: unknown[] = Array.isArray(body) ? body : [body];
    if (batch.length === 0 || batch.length > 100) {
      throw new BadRequestException(
        'Send between 1 and 100 prediction reports',
      );
    }
    return Promise.all(batch.map((entry) => this.parseReport(entry)));
  }

  private async parseReport(entry: unknown): Promise<EdgePredictionReport> {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new BadRequestException('Each prediction report must be an object');
    }

    if ('frames' in entry || 'generatedAt' in entry) {
      const report = (await this.validation.transform(entry, {
        type: 'body',
        metatype: ForecastBatchDto,
      })) as ForecastBatchDto;
      const { agentId } = report;
      const generatedAt = timestamp(report.generatedAt, 'generatedAt');
      return {
        agentId,
        generatedAt,
        frames: report.frames.map((frame) => {
          if ((frame.lat == null) !== (frame.lng == null)) {
            throw new BadRequestException(
              'lat and lng must be provided together',
            );
          }
          return {
            ...frame,
            nodeId: ownedNodeId(agentId, frame.nodeId),
            lat: frame.lat ?? undefined,
            lng: frame.lng ?? undefined,
            observedAt: frame.observedAt
              ? timestamp(frame.observedAt, 'observedAt')
              : undefined,
            targetTimestamp: timestamp(
              frame.targetTimestamp,
              'targetTimestamp',
            ),
          };
        }),
      };
    }

    const report = (await this.validation.transform(entry, {
      type: 'body',
      metatype: LegacyPredictionDto,
    })) as LegacyPredictionDto;
    const { edgeAgentId: agentId, currentSpeedRatio, confidence } = report;
    const observedAt = timestamp(report.observedAt, 'observedAt');
    const nodeId = ownedNodeId(agentId, report.nodeId);
    return {
      agentId,
      generatedAt: observedAt,
      frames: report.forecasts.map(
        ({ horizonMinutes, predictedSpeedRatio, status }) => {
          if (classifyTrafficStatus(predictedSpeedRatio) !== status) {
            throw new BadRequestException(
              `Forecast status disagrees with its speed ratio at ${horizonMinutes} minutes`,
            );
          }
          return {
            nodeId,
            currentSpeedRatio,
            confidence,
            observedAt,
            predictedSpeedRatio,
            targetTimestamp: timestamp(
              this.buckets.requestedTime(observedAt, horizonMinutes),
              'targetTimestamp',
            ),
          };
        },
      ),
    };
  }
}
