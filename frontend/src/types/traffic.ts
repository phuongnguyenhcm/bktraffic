/** Mirror các Response DTO canonical của Backend (Agents.md §3) — không có trường TomTom */

export type PredictionHorizon = 5 | 10 | 30 | 60
export type TrafficStatus = 'CLEAR' | 'MODERATE' | 'CONGESTED' | 'UNKNOWN'
export type GeometryMode = 'auto' | 'manual'
export type LatLon = [number, number]

export const PREDICTION_HORIZONS: readonly PredictionHorizon[] = [5, 10, 30, 60]

export interface InternalNode {
  id: string
  index: number
  name: string
  lat: number
  lon: number
  speedLimitKmh: number
  polyline?: LatLon[]
}

export interface NodePrediction {
  nodeId: string
  horizonMinutes: PredictionHorizon
  currentSpeedRatio: number
  predictedSpeedRatio: number
  predictedSpeedKmh: number
  confidence: number
  status: TrafficStatus
  timestamp: string
  targetTimestamp: string | null
  timeBucket: number | null
  latestGeneratedAt: string | null
}

export interface MapNode extends InternalNode {
  localId: string
  polyline: LatLon[]
  currentSpeedRatio: number
  currentSpeedKmh: number
  predictedSpeed: number
  speedRatio: number
  predictedSpeedRatio: number
  predictedSpeedKmh: number
  confidence: number
  status: TrafficStatus
  timestamp: string
  targetTimestamp: string | null
  timeBucket: number | null
  latestGeneratedAt: string | null
}

export interface MapEdge {
  id: string
  fromNodeId: string
  toNodeId: string
  isOneWay: boolean
  geometryMode: GeometryMode
  polyline: LatLon[]
  predictedSpeedRatio: number
  predictedSpeedKmh: number
  confidence: number
  status: TrafficStatus
}

export interface TrafficMapResponse {
  horizonMinutes: PredictionHorizon
  generatedAt: string
  targetTimestamp: string | null
  timeBucket: number | null
  latestGeneratedAt: string | null
  dataTimestamp: string | null
  nodes: MapNode[]
  edges: MapEdge[]
  summary: { clear: number; moderate: number; congested: number }
}

export interface SpeedHistoryPoint {
  timestamp: string
  speedRatio: number
  speedKmh: number
}

export interface NodeHistoryResponse {
  node: InternalNode
  history: SpeedHistoryPoint[]
  forecasts: NodePrediction[]
}

// ───────────── Edge nodes ─────────────

export type EdgeAgentStatus = 'ONLINE' | 'OFFLINE'

export interface EdgeAgent {
  id: string
  agentId: string
  name: string
  region: string
  status: EdgeAgentStatus
  managedNodeIds: string[]
  managedNodeCount: number
  lastSeenAt: string
}

export interface ConfigNodeInput {
  id: string
  lat: number
  lon: number
  speedLimitKmh?: number
  polyline?: LatLon[]
}

export interface ResolvedSegment {
  lat: number
  lon: number
  speedLimitKmh: number
  polyline: LatLon[]
  frc?: string
}

export interface PlaceSuggestion {
  id: string
  label: string
  address: string
  lat: number
  lon: number
}

export interface ConfigConnectionInput {
  from: string
  to: string
  isOneWay: boolean
  geometryMode: GeometryMode
  polyline?: LatLon[]
}

export interface GenerateConfigRequest {
  agentName?: string
  nodes: ConfigNodeInput[]
  connections: ConfigConnectionInput[]
}

/** Cấu hình cung đường theo hợp đồng Backend API. */
export interface TargetConfigFile {
  nodes: Record<string, { lat: number; lon: number; speed_limit?: number; name?: string; geometry_mode?: GeometryMode; polyline?: LatLon[] }>
  connections: {
    from: string
    to: string
    is_one_way: boolean
    geometry_mode?: GeometryMode
    polyline?: LatLon[]
  }[]
}

export interface GenerateConfigResponse {
  fileName: string
  config: TargetConfigFile
  stats: { nodeCount: number; connectionCount: number; manualConnectionCount: number }
}
