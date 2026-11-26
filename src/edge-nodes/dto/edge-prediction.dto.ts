import {
  BadRequestException,
  Injectable,
  ValidationPipe,
  type PipeTransform,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsObject,
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
  PREDICTION_HORIZONS,
  PREDICTION_NODE_ID_PATTERN,
  REPORTED_TRAFFIC_STATUSES,
  type EdgeForecast,
  type EdgePredictionReport,
  type PredictionHorizon,
} from '../../common/domain/traffic.models.js';

class EdgeForecastDto implements EdgeForecast {
  @IsIn(PREDICTION_HORIZONS)
  horizonMinutes: PredictionHorizon;

  @IsNumber()
  @Min(0)
  @Max(1)
  predictedSpeedRatio: number;

  @IsIn(REPORTED_TRAFFIC_STATUSES)
  status: EdgeForecast['status'];
}

class EdgePredictionDto {
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
  @ArrayMinSize(PREDICTION_HORIZONS.length)
  @ArrayMaxSize(PREDICTION_HORIZONS.length)
  @ArrayUnique((forecast: EdgeForecastDto | null) => forecast?.horizonMinutes)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => EdgeForecastDto)
  forecasts: EdgeForecastDto[];

  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:?\d{2})$/i, {
    message: 'observedAt must include a timezone',
  })
  observedAt: string;
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

  async transform(body: unknown): Promise<EdgePredictionReport[]> {
    const batch = Array.isArray(body) ? body : [body];
    if (batch.length === 0 || batch.length > 100) {
      throw new BadRequestException(
        'Send between 1 and 100 prediction reports',
      );
    }
    return Promise.all(
      batch.map(async (entry: unknown) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          throw new BadRequestException(
            'Each prediction report must be an object',
          );
        }
        const report = (await this.validation.transform(entry, {
          type: 'body',
          metatype: EdgePredictionDto,
        })) as EdgePredictionDto;
        const observedAt = new Date(report.observedAt);
        if (!Number.isFinite(observedAt.getTime())) {
          throw new BadRequestException(
            'observedAt must be a valid ISO 8601 timestamp',
          );
        }
        for (const forecast of report.forecasts) {
          if (
            classifyTrafficStatus(forecast.predictedSpeedRatio) !==
            forecast.status
          ) {
            throw new BadRequestException(
              `Forecast status disagrees with its speed ratio at ${forecast.horizonMinutes} minutes`,
            );
          }
        }
        const {
          nodeId,
          edgeAgentId,
          currentSpeedRatio,
          confidence,
          forecasts,
        } = report;
        const globalNodeId = nodeId.includes('::')
          ? nodeId
          : buildGlobalNodeId(edgeAgentId, nodeId);
        if (!globalNodeId.startsWith(`${edgeAgentId}::`)) {
          throw new BadRequestException('nodeId must belong to edgeAgentId');
        }
        return {
          nodeId: globalNodeId,
          edgeAgentId,
          currentSpeedRatio,
          confidence,
          forecasts,
          observedAt,
        };
      }),
    );
  }
}
