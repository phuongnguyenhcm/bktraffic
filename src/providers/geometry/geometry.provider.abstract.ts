import type { InternalEdge, InternalNode, LatLon } from '../../common/domain/traffic.models.js';

/**
 * Agents.md §4.B — Tách việc phân giải hình học đường khỏi domain logic và Frontend.
 * Chỉ được gọi ở ranh giới response (lazy geometry resolution).
 */
export abstract class AbstractGeometryProvider {
  abstract resolveEdgePolyline(
    edge: InternalEdge,
    fromNode: InternalNode,
    toNode: InternalNode,
  ): Promise<LatLon[]>;
}
