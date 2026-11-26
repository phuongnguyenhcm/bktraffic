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
 * Implementation hiện tại: MongoPredictionProvider.
 * Tương lai: FederatedGrpcPredictionProvider / PythonHttpPredictionProvider (đổi `useClass`).
 */
export abstract class AbstractPredictionProvider {
  abstract predictNode(node: InternalNode, horizon: PredictionHorizon): Promise<NodePrediction>;

  predictNodes(nodes: readonly InternalNode[], horizon: PredictionHorizon, _now?: Date): Promise<NodePrediction[]> {
    return Promise.all(nodes.map((node) => this.predictNode(node, horizon)));
  }

  abstract getNodeHistoryAndForecast(
    node: InternalNode,
    horizons: PredictionHorizon[],
    historyLimit?: number,
  ): Promise<NodeHistoryAndForecast>;
}
