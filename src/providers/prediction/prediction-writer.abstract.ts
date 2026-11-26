import type { EdgePredictionReport } from '../../common/domain/traffic.models.js';

export abstract class AbstractPredictionWriter {
  abstract store(report: EdgePredictionReport): Promise<void>;
}
