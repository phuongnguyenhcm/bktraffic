/** Mirror các Response DTO canonical của Backend (Agents.md §3) — không có trường TomTom */

export type PredictionHorizon = 5 | 10 | 30 | 60
export type TrafficStatus = 'CLEAR' | 'MODERATE' | 'CONGESTED'
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
}

export interface MapNode extends InternalNode {
  currentSpeedRatio: number
  currentSpeedKmh: number
  predictedSpeedRatio: number
  predictedSpeedKmh: number
  confidence: number
  status: TrafficStatus
  timestamp: string
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

export type EdgeAgentStatus = 'ONLINE' | 'TRAINING' | 'IDLE'

export interface EdgeAgent {
  id: string
  name: string
  region: string
  device: string
  status: EdgeAgentStatus
  managedNodeIds: string[]
  managedNodeCount: number
  currentRound: number
  totalRounds: number
  localLoss: number
  lastHeartbeat: string
}

export interface ConfigNodeInput {
  id: string
  lat: number
  lon: number
  speedLimitKmh?: number
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

/** Cấu trúc file target.json (snake_case như file gốc + trường mở rộng) */
export interface TargetConfigFile {
  nodes: Record<string, { lat: number; lon: number; speed_limit?: number }>
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
