import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { InternalNode } from '../../common/domain/traffic.models.js';
import { SimulatedCsvPredictionProvider, parseSpeedCsv } from './simulated-csv-prediction.provider.js';

const node = (index: number, speedLimitKmh = 40): InternalNode => ({
  id: `N${index}`,
  index,
  name: `Node ${index}`,
  lat: 10.77,
  lon: 106.66,
  speedLimitKmh,
});

function csv(rows: [number, number, number, string][]): string {
  const header = 'direction_index,frc,speed_ratio,confidence,timestamp,day_of_week,hour,minute';
  return [header, ...rows.map(([i, r, c, t]) => `${i},FRC2,${r},${c},${t},0,0,0`)].join('\r\n');
}

describe('SimulatedCsvPredictionProvider', () => {
  let dir: string;
  let provider: SimulatedCsvPredictionProvider;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'pred-'));
    const rows: [number, number, number, string][] = [];
    // node 0: thông thoáng ổn định; node 1: kẹt xe giảm dần
    for (let m = 0; m < 30; m += 5) {
      const ts = `2026-08-24 08:${String(m).padStart(2, '0')}:00`;
      rows.push([0, 0.95, 1, ts]);
      rows.push([1, 0.5 - m / 100, 0.9, ts]);
    }
    await writeFile(path.join(dir, 'speed.csv'), csv(rows));
    const config = new ConfigService({ DATA_DIR: dir, SIMULATION_MODE: 'latest', DATA_TIMEZONE_OFFSET: '+07:00' });
    provider = new SimulatedCsvPredictionProvider(config);
  });

  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('parses CSV and ignores provider-specific columns', () => {
    const ds = parseSpeedCsv(csv([[3, 0.7, 1, '2026-08-24 20:52:38']]), '+07:00');
    expect(ds.byIndex.get(3)).toEqual([{ t: Date.parse('2026-08-24T20:52:38+07:00'), ratio: 0.7, confidence: 1 }]);
  });

  it('skips missing sensor indices and ratios without discarding a zero speed ratio', () => {
    const data = [
      'direction_index,speed_ratio,confidence,timestamp',
      ',0.7,1,2026-08-24 20:52:38',
      '0,,1,2026-08-24 20:52:38',
      '0,0,1,2026-08-24 20:52:38',
    ].join('\n');
    const dataset = parseSpeedCsv(data, '+07:00');
    expect(dataset.byIndex.get(0)).toEqual([
      { t: Date.parse('2026-08-24T20:52:38+07:00'), ratio: 0, confidence: 1 },
    ]);
  });

  it('classifies the same rounded ratio returned to clients', async () => {
    const timestamp = '2026-08-24 08:00:00';
    await writeFile(path.join(dir, 'speed.csv'), csv([
      [0, 0.7499, 1, timestamp],
      [1, 0.4499, 1, timestamp],
    ]));

    expect(await provider.predictNode(node(0), 5)).toMatchObject({ predictedSpeedRatio: 0.75, status: 'CLEAR' });
    expect(await provider.predictNode(node(1), 5)).toMatchObject({ predictedSpeedRatio: 0.45, status: 'MODERATE' });
  });

  it('uses latest speed_ratio as current and derives km/h from speedLimitKmh', async () => {
    const p = await provider.predictNode(node(0, 50), 5);
    expect(p.currentSpeedRatio).toBe(0.95);
    expect(p.status).toBe('CLEAR');
    expect(p.predictedSpeedKmh).toBeCloseTo(p.predictedSpeedRatio * 50, 1);
    expect(p.timestamp).toBe(new Date(Date.parse('2026-08-24T08:25:00+07:00') + 5 * 60_000).toISOString());
  });

  it('classifies congested nodes and lowers confidence for longer horizons', async () => {
    const short = await provider.predictNode(node(1), 5);
    const long = await provider.predictNode(node(1), 60);
    expect(short.currentSpeedRatio).toBe(0.25);
    expect(short.status).toBe('CONGESTED');
    expect(long.confidence).toBeLessThan(short.confidence);
  });

  it('returns zero confidence when a node has no samples', async () => {
    const p = await provider.predictNode(node(9), 10);
    expect(p.confidence).toBe(0);
  });

  it('returns history and one forecast per requested horizon', async () => {
    const res = await provider.getNodeHistoryAndForecast(node(0), [5, 10, 30, 60], 4);
    expect(res.history).toHaveLength(4);
    expect(res.forecasts.map((f) => f.horizonMinutes)).toEqual([5, 10, 30, 60]);
  });
});
