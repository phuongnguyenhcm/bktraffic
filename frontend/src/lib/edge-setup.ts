import type { GenerateConfigRequest, GeometryMode, LatLon } from '@/types/traffic'
import type { Messages } from '@/i18n/vi'

export interface MonitoringPoint {
  id: string
  name: string
  coordinates: LatLon
  speedLimitKmh: number
  polyline?: LatLon[]
}

export interface MonitoringLink {
  key: number
  from: string
  to: string
  isOneWay: boolean
  geometryMode: GeometryMode
  polyline?: LatLon[]
}

export interface MonitoringArea {
  points: MonitoringPoint[]
  links: MonitoringLink[]
}

export interface AreaDraft {
  points: Omit<MonitoringPoint, 'id'>[]
  links: (Omit<MonitoringLink, 'key' | 'from' | 'to'> & { from: number; to: number })[]
}

export const DEFAULT_SPEED_LIMIT = 40
export const MAX_POINTS = 500
export const MAX_LINKS = 2000

let sequence = 0
export const nextLinkKey = () => ++sequence

export function coordinateKey(coordinates: LatLon): string {
  return coordinates.map((value) => value.toFixed(6)).join(',')
}

export function validCoordinate(lat: unknown, lon: unknown): lat is number {
  return typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90
    && typeof lon === 'number' && Number.isFinite(lon) && Math.abs(lon) <= 180
}

function makeId(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 55) || 'diem-do'
}

function linkKey(from: string, to: string): string {
  return `${from}__${to}`
}

function conflicts(existing: Map<string, boolean>, link: Pick<MonitoringLink, 'from' | 'to' | 'isOneWay'>): boolean {
  const reverse = linkKey(link.to, link.from)
  return existing.has(linkKey(link.from, link.to)) || existing.get(reverse) === false || (!link.isOneWay && existing.has(reverse))
}

export function appendArea(area: MonitoringArea, draft: AreaDraft): MonitoringArea | null {
  const points = [...area.points]
  const links = [...area.links]
  const byCoordinate = new Map(points.map((point) => [coordinateKey(point.coordinates), point.id]))
  const ids = new Set(points.map(({ id }) => id))
  const importedIds = draft.points.map((point) => {
    const location = coordinateKey(point.coordinates)
    const existing = byCoordinate.get(location)
    if (existing) return existing
    const base = makeId(point.name)
    let id = base
    for (let suffix = 2; ids.has(id); suffix++) id = `${base}-${suffix}`
    ids.add(id)
    byCoordinate.set(location, id)
    points.push({ ...point, id })
    return id
  })

  const existing = new Map(links.map((link) => [linkKey(link.from, link.to), link.isOneWay]))
  const positions = new Map(links.map((link, index) => [linkKey(link.from, link.to), index]))
  for (const link of draft.links) {
    const from = importedIds[link.from]
    const to = importedIds[link.to]
    if (!from || !to || from === to) continue
    const entry = { ...link, from, to }
    const key = linkKey(from, to)
    if (conflicts(existing, entry)) {
      const index = positions.get(key)
      // An uploaded shape can replace the inferred geometry on the same link.
      if (index !== undefined && links[index].geometryMode === 'auto' && entry.geometryMode === 'manual') {
        links[index] = { ...entry, isOneWay: links[index].isOneWay, key: links[index].key }
      }
      continue
    }
    existing.set(key, entry.isOneWay)
    positions.set(key, links.length)
    links.push({ ...entry, key: nextLinkKey() })
  }

  if (points.length > MAX_POINTS || links.length > MAX_LINKS) return null
  return { points, links }
}

export function buildAreaRequest(
  { points, links }: MonitoringArea,
  messages: Pick<Messages['setup'], 'invalidConnection' | 'duplicateConnection'>,
): {
  request: Pick<GenerateConfigRequest, 'nodes' | 'connections'> | null
  errors: string[]
} {
  if (!points.length) return { request: null, errors: [] }
  const errors: string[] = []
  const ids = new Set(points.map(({ id }) => id))
  const seen = new Map<string, boolean>()
  const connections = links.map((link, index) => {
    if (!ids.has(link.from) || !ids.has(link.to) || link.from === link.to) {
      errors.push(messages.invalidConnection(index + 1))
    } else if (conflicts(seen, link)) {
      errors.push(messages.duplicateConnection(index + 1))
    }
    seen.set(linkKey(link.from, link.to), link.isOneWay)
    const { from, to, geometryMode, isOneWay, polyline } = link
    return { from, to, geometryMode, isOneWay, ...(geometryMode === 'manual' && polyline ? { polyline } : {}) }
  })
  return {
    request: errors.length ? null : {
      nodes: points.map(({ id, coordinates: [lat, lon], speedLimitKmh, polyline }) => ({
        id, lat, lon, speedLimitKmh, ...(polyline ? { polyline } : {}),
      })),
      connections,
    },
    errors,
  }
}
