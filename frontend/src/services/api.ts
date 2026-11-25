import type {
  EdgeAgent,
  GenerateConfigRequest,
  GenerateConfigResponse,
  NodeHistoryResponse,
  PredictionHorizon,
  TrafficMapResponse,
} from '@/types/traffic'

/**
 * Tầng HTTP duy nhất của Frontend (Agents.md §6) — component không gọi fetch trực tiếp.
 */
const apiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '') ?? ''
const TIMEOUT_MS = 10_000

export class ApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function extractMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('message' in body)) return null
  const msg = body.message
  if (Array.isArray(msg)) return msg.filter((m): m is string => typeof m === 'string').join(' • ') || null
  return typeof msg === 'string' ? msg : null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
  let res: Response
  try {
    res = await fetch(`${apiUrl}/api${path}`, { ...init, signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new ApiError('Backend phản hồi quá chậm (timeout).', null)
    }
    throw new ApiError('Không kết nối được Backend. Hãy kiểm tra server NestJS đã chạy chưa.', null)
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(extractMessage(body) ?? `Lỗi máy chủ (${res.status})`, res.status)
  if (body === null) throw new ApiError('Máy chủ trả về dữ liệu không hợp lệ.', res.status)
  return body as T
}

export function toErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  return err instanceof Error ? err.message : 'Đã xảy ra lỗi không xác định'
}


export function fetchTrafficMap(horizon: PredictionHorizon, signal?: AbortSignal) {
  return request<TrafficMapResponse>(`/traffic/map?horizon=${horizon}`, { signal })
}

export function fetchNodeHistory(nodeId: string, signal?: AbortSignal) {
  return request<NodeHistoryResponse>(`/traffic/nodes/${encodeURIComponent(nodeId)}/history`, { signal })
}

export function fetchEdgeNodes(signal?: AbortSignal) {
  return request<EdgeAgent[]>('/edge-nodes', { signal })
}

export function generateEdgeConfig(body: GenerateConfigRequest, signal?: AbortSignal) {
  return request<GenerateConfigResponse>('/edge-nodes/generate-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
}
