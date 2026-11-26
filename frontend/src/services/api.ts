import type {
  EdgeAgent,
  GenerateConfigRequest,
  GenerateConfigResponse,
  LatLon,
  NodeHistoryResponse,
  PlaceSuggestion,
  PredictionHorizon,
  ResolvedSegment,
  TrafficMapResponse,
} from '@/types/traffic'
import type { Messages } from '@/i18n/vi'

/**
 * Tầng HTTP duy nhất của Frontend (Agents.md §6) — component không gọi fetch trực tiếp.
 */
const apiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '') ?? ''
const TIMEOUT_MS = 10_000

export class ApiError extends Error {
  readonly code: keyof Messages['api']
  readonly status: number | null

  constructor(code: keyof Messages['api'], status: number | null) {
    super(code)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

function extractMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('message' in body)) return null
  const msg = body.message
  if (Array.isArray(msg)) return msg.filter((m): m is string => typeof m === 'string').join(' • ') || null
  return typeof msg === 'string' ? msg : null
}

function responseError(path: string, status: number, body: unknown): ApiError {
  if (path.startsWith('/topology/')) {
    const detail = extractMessage(body) ?? ''
    if (status === 404 && path.startsWith('/topology/resolve-segment')) return new ApiError('noSegment', status)
    if (status === 503 && detail.includes('TOMTOM_API_KEY')) return new ApiError('tomtomKey', status)
    if (status === 503) return new ApiError('tomtomUnavailable', status)
    if (status === 504) return new ApiError('tomtomTimeout', status)
    if (status === 502 && detail.includes('từ chối khóa API')) return new ApiError('tomtomRejected', status)
    if (status === 502 && detail.includes('Không kết nối được với TomTom')) return new ApiError('tomtomConnection', status)
    return new ApiError(path.startsWith('/topology/search-place') ? 'tomtomSearch' : 'tomtomSegment', status)
  }
  if (status === 400 && path === '/edge-nodes/generate-config') return new ApiError('configInvalid', status)
  return new ApiError('http', status)
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
      throw new ApiError('timeout', null)
    }
    throw new ApiError('connection', null)
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) throw responseError(path, res.status, body)
  if (body === null) throw new ApiError('invalidResponse', res.status)
  return body as T
}

export function toErrorMessage(error: unknown, messages: Messages['api']): string {
  if (!(error instanceof ApiError)) return messages.unknown
  if (error.code === 'http') return error.status === null ? messages.unknown : messages.http(error.status)
  return messages[error.code]
}


export function fetchTrafficMap(horizon: PredictionHorizon, signal?: AbortSignal) {
  return request<TrafficMapResponse>(`/traffic/map?horizon=${horizon}`, { signal })
}

export function fetchNodeHistory(nodeId: string, signal?: AbortSignal) {
  return request<NodeHistoryResponse>(`/traffic/nodes/${encodeURIComponent(nodeId)}`, { signal })
}

export function fetchEdgeNodes(signal?: AbortSignal) {
  return request<EdgeAgent[]>('/edge-nodes', { signal })
}

export function resolveRoadSegment([lat, lon]: LatLon, signal?: AbortSignal) {
  const query = new URLSearchParams({ lat: String(lat), lon: String(lon) })
  return request<ResolvedSegment>(`/topology/resolve-segment?${query}`, { signal })
}

export function searchPlaces(query: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ q: query })
  return request<PlaceSuggestion[]>(`/topology/search-place?${params}`, { signal })
}

export function generateEdgeConfig(body: GenerateConfigRequest, signal?: AbortSignal) {
  return request<GenerateConfigResponse>('/edge-nodes/generate-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
}
