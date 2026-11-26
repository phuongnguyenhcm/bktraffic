import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isLatLon } from '../../common/config/target-config.js';

const GEOHASH_ALPHABET = '0123456789bcdefghjkmnpqrstuvwxyz';
const MAX_DATE_MS = 8_640_000_000_000_000;

function configuredInteger(
  config: ConfigService,
  name: string,
  fallback: number,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const raw = config.get<string | number>(name);
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

@Injectable()
export class ForecastBucketingService {
  private readonly precision: number;
  private readonly bucketMs: number;
  private readonly windowMs: number;

  constructor(config: ConfigService) {
    this.precision = configuredInteger(
      config,
      'FORECAST_GEOHASH_PRECISION',
      8,
      1,
      12,
    );
    this.bucketMs = configuredInteger(
      config,
      'FORECAST_TIME_BUCKET_MS',
      60_000,
      1,
    );
    this.windowMs = configuredInteger(
      config,
      'FORECAST_MATCH_WINDOW_MS',
      60_000,
      0,
    );
  }

  spatialKey(nodeId: string, lat?: number, lng?: number): string {
    const coordinates = [lat, lng];
    if (!isLatLon(coordinates)) return nodeId;

    const bounds = [
      [-90, 90],
      [-180, 180],
    ];
    let hash = '';
    for (let bit = 0, character = 0; bit < this.precision * 5; bit++) {
      const axis = bit % 2 === 0 ? 1 : 0;
      const range = bounds[axis];
      const midpoint = (range[0] + range[1]) / 2;
      const upperHalf = coordinates[axis] >= midpoint;
      range[upperHalf ? 0 : 1] = midpoint;
      character = (character << 1) | Number(upperHalf);
      if (bit % 5 === 4) {
        hash += GEOHASH_ALPHABET[character];
        character = 0;
      }
    }
    return hash;
  }

  timeBucket(target: Date | number): number {
    return Math.floor(Number(target) / this.bucketMs) * this.bucketMs;
  }

  requestedTime(now: Date, horizonMinutes: number): Date {
    return new Date(now.getTime() + horizonMinutes * 60_000);
  }

  matchWindow(requestedTime: Date) {
    const timestamp = requestedTime.getTime();
    const earliest = Math.max(-MAX_DATE_MS, timestamp - this.windowMs);
    const latest = Math.min(MAX_DATE_MS, timestamp + this.windowMs);
    return {
      timeBucket: {
        $gte: this.timeBucket(earliest),
        $lte: this.timeBucket(latest),
      },
    };
  }

  matchRank(requestedTime: Date) {
    return {
      distance: { $abs: { $subtract: ['$targetTimestamp', requestedTime] } },
      nearestFirst: {
        distance: 1,
        generatedAt: -1,
        targetTimestamp: 1,
        agentId: 1,
      } as const,
    };
  }

  compareTargets(requestedTime: Date, left: Date, right: Date): number {
    const requested = requestedTime.getTime();
    return (
      Math.abs(left.getTime() - requested) -
        Math.abs(right.getTime() - requested) ||
      left.getTime() - right.getTime()
    );
  }

  expiresAt(timeBucket: number): Date {
    return new Date(
      Math.min(MAX_DATE_MS, timeBucket + this.bucketMs + this.windowMs),
    );
  }
}
