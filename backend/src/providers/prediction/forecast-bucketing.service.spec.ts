import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { ForecastBucketingService } from './forecast-bucketing.service.js';

function service(
  values: Record<string, string> = {},
): ForecastBucketingService {
  const config = new ConfigService();
  vi.spyOn(config, 'get').mockImplementation((key) => values[String(key)]);
  return new ForecastBucketingService(config);
}

describe('ForecastBucketingService', () => {
  it('encodes standard geohashes using the configured precision', () => {
    expect(service().spatialKey('node', 57.64911, 10.40744)).toBe('u4pruydq');
    expect(
      service({ FORECAST_GEOHASH_PRECISION: '5' }).spatialKey(
        'node',
        42.6,
        -5.6,
      ),
    ).toBe('ezs42');
  });

  it('uses the node ID when coordinates are absent or invalid', () => {
    const buckets = service();
    expect(buckets.spatialKey('agent::node')).toBe('agent::node');
    expect(buckets.spatialKey('agent::node', 10)).toBe('agent::node');
    expect(buckets.spatialKey('agent::node', 91, 0)).toBe('agent::node');
    expect(buckets.spatialKey('agent::node', 0, 0)).toBe('s0000000');
  });

  it('floors timestamps to the start of their bucket, including before the epoch', () => {
    const buckets = service();
    expect(buckets.timeBucket(new Date(119_999))).toBe(60_000);
    expect(buckets.timeBucket(120_000)).toBe(120_000);
    expect(buckets.timeBucket(-1)).toBe(-60_000);
    expect(service({ FORECAST_TIME_BUCKET_MS: '1500' }).timeBucket(4501)).toBe(
      4500,
    );
  });

  it('includes the buckets that intersect the configured window', () => {
    const buckets = service({
      FORECAST_TIME_BUCKET_MS: '1500',
      FORECAST_MATCH_WINDOW_MS: '800',
    });
    expect(buckets.matchWindow(new Date(3100))).toEqual({
      timeBucket: { $gte: 1500, $lte: 3000 },
    });
    expect(buckets.matchWindow(new Date(3700))).toEqual({
      timeBucket: { $gte: 1500, $lte: 4500 },
    });
    expect(buckets.expiresAt(4500)).toEqual(new Date(6800));
  });

  it('matches only the requested bucket when the window is zero', () => {
    const buckets = service({ FORECAST_MATCH_WINDOW_MS: '0' });
    const requested = buckets.requestedTime(new Date(12_345), 7);
    expect(requested).toEqual(new Date(432_345));
    expect(buckets.matchWindow(requested)).toEqual({
      timeBucket: { $gte: 420_000, $lte: 420_000 },
    });
    expect(
      buckets.compareTargets(requested, new Date(432_000), new Date(433_000)),
    ).toBeLessThan(0);
  });

  it('rejects invalid configuration at startup', () => {
    expect(() => service({ FORECAST_GEOHASH_PRECISION: '0' })).toThrow(
      'FORECAST_GEOHASH_PRECISION',
    );
    expect(() => service({ FORECAST_TIME_BUCKET_MS: '0' })).toThrow(
      'FORECAST_TIME_BUCKET_MS',
    );
    expect(() => service({ FORECAST_MATCH_WINDOW_MS: '-1' })).toThrow(
      'FORECAST_MATCH_WINDOW_MS',
    );
  });
});
