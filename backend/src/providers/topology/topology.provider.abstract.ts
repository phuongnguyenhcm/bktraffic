import type { InternalEdge, InternalNode } from '../../common/domain/traffic.models.js';

/**
 * Agents.md §4.C — Nguồn topology (node + edge) của mạng lưới.
 * Có thể thay bằng provider đọc từ DB / FL Server mà không ảnh hưởng tầng service.
 */
export abstract class AbstractTopologyProvider {
  abstract getNodes(): Promise<InternalNode[]>;
  abstract getEdges(): Promise<InternalEdge[]>;
}
