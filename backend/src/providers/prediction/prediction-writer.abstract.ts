import type { EdgePredictionReport } from '../../common/domain/traffic.models.js';

export abstract class AbstractPredictionWriter {
  abstract store(reports: readonly EdgePredictionReport[]): Promise<void>;
}
