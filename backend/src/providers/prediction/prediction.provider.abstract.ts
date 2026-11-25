import type {
  InternalNode,
  NodePrediction,
  PredictionHorizon,
  SpeedHistoryPoint,
} from '../../common/domain/traffic.models.js';

export interface NodeHistoryAndForecast {
  history: SpeedHistoryPoint[];
  forecasts: NodePrediction[];
}

/**
 * Agents.md §4.A — Tách Backend khỏi engine suy luận ML.
 * Implementation hiện tại: SimulatedCsvPredictionProvider.
 * Tương lai: FederatedGrpcPredictionProvider / PythonHttpPredictionProvider (đổi `useClass`).
 */
export abstract class AbstractPredictionProvider {
  abstract predictNode(node: InternalNode, horizon: PredictionHorizon): Promise<NodePrediction>;

  abstract getNodeHistoryAndForecast(
    node: InternalNode,
    horizons: PredictionHorizon[],
    historyLimit?: number,
  ): Promise<NodeHistoryAndForecast>;
}
