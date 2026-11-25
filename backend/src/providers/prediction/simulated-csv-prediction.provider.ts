import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  classifyTrafficStatus,
  type InternalNode,
  type NodePrediction,
  type PredictionHorizon,
  type SpeedHistoryPoint,
} from '../../common/domain/traffic.models.js';
import { MtimeCachedFile, parseCsv, resolveDataPath } from '../../common/data/data-files.js';
import { AbstractPredictionProvider, type NodeHistoryAndForecast } from './prediction.provider.abstract.js';

/** Một mẫu cảm biến đã chuẩn hoá (chỉ giữ trường canonical — bỏ FRC v.v.) */
export interface SpeedSample {
  t: number; // epoch ms
  ratio: number;
  confidence: number;
}

export interface SpeedDataset {
  byIndex: Map<number, SpeedSample[]>; // sắp xếp tăng dần theo t
  timeline: number[]; // các mốc thời gian duy nhất (tăng dần)
}

type SimulationMode = 'latest' | 'replay';

const MINUTE = 60_000;
const RECENT_WINDOW = 6; // 6 mẫu ≈ 30 phút (bước 5 phút)
const DEFAULT_HISTORY_LIMIT = 24; // ≈ 2 giờ
const MIN_RATIO = 0.05;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round = (v: number, d = 3): number => Math.round(v * 10 ** d) / 10 ** d;

/** Parse speed.csv → dataset theo index. Bỏ qua dòng hỏng. Timestamp hiểu theo offset cấu hình. */
export function parseSpeedCsv(content: string, tzOffset: string): SpeedDataset {
  const byIndex = new Map<number, SpeedSample[]>();
  const times = new Set<number>();
  for (const r of parseCsv(content)) {
    if (!r['direction_index'] || !r['speed_ratio']) continue;
    const index = Number(r['direction_index']);
    const ratio = Number(r['speed_ratio']);
    const confidence = Number(r['confidence']);
    const t = Date.parse(`${(r['timestamp'] ?? '').replace(' ', 'T')}${tzOffset}`);
    if (!Number.isInteger(index) || index < 0 || !Number.isFinite(ratio) || Number.isNaN(t)) continue;
    const list = byIndex.get(index) ?? [];
    list.push({ t, ratio: clamp(ratio, 0, 1), confidence: Number.isFinite(confidence) ? clamp(confidence, 0, 1) : 1 });
    byIndex.set(index, list);
    times.add(t);
  }
  byIndex.forEach((list) => list.sort((a, b) => a.t - b.t));
  return { byIndex, timeline: [...times].sort((a, b) => a - b) };
}

/**
 * Mô phỏng đầu ra mô hình LSTM-FedProx từ dữ liệu cảm biến giả lập (`speed.csv`).
 *
 * Dự báo cho horizon h (phút) = pha trộn giữa
 *  - thành phần ngắn hạn: mức EWMA của 30 phút gần nhất + xu hướng tuyến tính (bão hoà dần),
 *  - thành phần mùa vụ: trung bình speed_ratio của node tại cùng khung giờ trong ngày,
 * với trọng số mùa vụ w = h / (h + 30) (horizon càng xa càng dựa vào quy luật theo giờ).
 * Độ tin cậy giảm theo horizon và theo độ biến động gần đây.
 */
@Injectable()
export class SimulatedCsvPredictionProvider extends AbstractPredictionProvider {
  private readonly logger = new Logger(SimulatedCsvPredictionProvider.name);
  private readonly file: MtimeCachedFile<SpeedDataset>;
  private readonly mode: SimulationMode;
  private readonly tzOffset: string;
  private readonly warnedMissing = new Set<number>();

  constructor(config: ConfigService) {
    super();
    this.tzOffset = config.get<string>('DATA_TIMEZONE_OFFSET', '+07:00');
    this.mode = config.get<string>('SIMULATION_MODE', 'latest') === 'replay' ? 'replay' : 'latest';
    this.file = new MtimeCachedFile(
      resolveDataPath(config.get<string>('DATA_DIR', 'data'), 'speed.csv'),
      (content) => parseSpeedCsv(content, this.tzOffset),
    );
  }

  async predictNode(node: InternalNode, horizon: PredictionHorizon): Promise<NodePrediction> {
    const dataset = await this.file.get();
    return this.forecast(node, this.recentSamples(dataset, node), dataset, horizon);
  }

  async getNodeHistoryAndForecast(
    node: InternalNode,
    horizons: PredictionHorizon[],
    historyLimit = DEFAULT_HISTORY_LIMIT,
  ): Promise<NodeHistoryAndForecast> {
    const dataset = await this.file.get();
    const samples = this.recentSamples(dataset, node);
    const history: SpeedHistoryPoint[] = samples.slice(-historyLimit).map((s) => ({
      timestamp: new Date(s.t).toISOString(),
      speedRatio: round(s.ratio),
      speedKmh: round(s.ratio * node.speedLimitKmh, 1),
    }));
    const forecasts = horizons.map((h) => this.forecast(node, samples, dataset, h));
    return { history, forecasts };
  }

  // ───────────────────────── internals ─────────────────────────

  /** Mốc "hiện tại" của mô phỏng: mới nhất (latest) hoặc phát lại theo đồng hồ thực (replay) */
  private referenceTime(dataset: SpeedDataset): number {
    const { timeline } = dataset;
    if (timeline.length === 0) return Date.now();
    if (this.mode === 'latest') return timeline[timeline.length - 1];
    const slot = Math.floor(Date.now() / (5 * MINUTE)) % timeline.length;
    return timeline[slot];
  }

  /** Toàn bộ mẫu của node có t ≤ mốc hiện tại */
  private recentSamples(dataset: SpeedDataset, node: InternalNode): SpeedSample[] {
    const all = dataset.byIndex.get(node.index) ?? [];
    if (all.length === 0 && !this.warnedMissing.has(node.index)) {
      this.warnedMissing.add(node.index);
      this.logger.warn(`No speed samples for node "${node.id}" (index ${node.index})`);
    }
    const ref = this.referenceTime(dataset);
    let end = all.length;
    while (end > 0 && all[end - 1].t > ref) end--;
    return all.slice(0, end);
  }

  private forecast(
    node: InternalNode,
    samples: SpeedSample[],
    dataset: SpeedDataset,
    horizon: PredictionHorizon,
  ): NodePrediction {
    const last = samples[samples.length - 1];
    const refTime = last?.t ?? this.referenceTime(dataset);
    const targetTime = refTime + horizon * MINUTE;
    const all = dataset.byIndex.get(node.index) ?? [];

    let current: number;
    let predicted: number;
    let confidence: number;

    if (!last) {
      // Không có dữ liệu: trả về giả định lưu thông tự do với độ tin cậy 0
      current = 1;
      predicted = 1;
      confidence = 0;
    } else {
      const recent = samples.slice(-RECENT_WINDOW);
      current = last.ratio;

      // EWMA (α = 0.5) — mức nền ngắn hạn
      let level = recent[0].ratio;
      for (const s of recent.slice(1)) level = 0.5 * s.ratio + 0.5 * level;

      // Hồi quy tuyến tính → độ dốc (ratio/phút), bão hoà theo horizon
      const slope = this.slopePerMinute(recent);
      const trendTerm = slope * 15 * (1 - Math.exp(-horizon / 15));
      const shortTerm = level + trendTerm;

      const seasonal = this.seasonalRatio(all, targetTime) ?? this.mean(all.map((s) => s.ratio));
      const w = horizon / (horizon + 30);
      predicted = clamp((1 - w) * shortTerm + w * seasonal, MIN_RATIO, 1);

      const volatility = this.stdDev(recent.map((s) => s.ratio));
      const confPenalty = Math.min(0.25, volatility * 1.2);
      confidence = clamp(last.confidence * (1 - 0.003 * horizon) * (1 - confPenalty), 0.3, 1);
    }

    const predictedSpeedRatio = round(predicted);
    return {
      nodeId: node.id,
      horizonMinutes: horizon,
      currentSpeedRatio: round(current),
      predictedSpeedRatio,
      predictedSpeedKmh: round(predictedSpeedRatio * node.speedLimitKmh, 1),
      confidence: round(confidence),
      status: classifyTrafficStatus(predictedSpeedRatio),
      timestamp: new Date(targetTime).toISOString(),
    };
  }

  /** Trung bình speed_ratio của node trong cửa sổ ±30 phút quanh cùng giờ-trong-ngày của target */
  private seasonalRatio(all: SpeedSample[], targetTime: number): number | null {
    const minuteOfDay = (t: number): number => {
      const d = new Date(t + this.offsetMinutes() * MINUTE);
      return d.getUTCHours() * 60 + d.getUTCMinutes();
    };
    const target = minuteOfDay(targetTime);
    const values = all
      .filter((s) => {
        const diff = Math.abs(minuteOfDay(s.t) - target);
        return Math.min(diff, 1440 - diff) <= 30;
      })
      .map((s) => s.ratio);
    return values.length ? this.mean(values) : null;
  }

  private offsetMinutes(): number {
    const m = /^([+-])(\d{2}):?(\d{2})$/.exec(this.tzOffset);
    if (!m) return 0;
    const v = Number(m[2]) * 60 + Number(m[3]);
    return m[1] === '-' ? -v : v;
  }

  private slopePerMinute(samples: SpeedSample[]): number {
    if (samples.length < 2) return 0;
    const t0 = samples[0].t;
    const xs = samples.map((s) => (s.t - t0) / MINUTE);
    const ys = samples.map((s) => s.ratio);
    const mx = this.mean(xs);
    const my = this.mean(ys);
    let num = 0;
    let den = 0;
    xs.forEach((x, i) => {
      num += (x - mx) * (ys[i] - my);
      den += (x - mx) ** 2;
    });
    return den === 0 ? 0 : num / den;
  }

  private mean(values: number[]): number {
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 1;
  }

  private stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const m = this.mean(values);
    return Math.sqrt(this.mean(values.map((v) => (v - m) ** 2)));
  }
}
