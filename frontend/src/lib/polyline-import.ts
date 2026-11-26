import { coordinateKey, DEFAULT_SPEED_LIMIT, validCoordinate, type AreaDraft } from '@/lib/edge-setup'
import type { LatLon } from '@/types/traffic'
import type { Messages } from '@/i18n/vi'

type Order = 'lat-lon' | 'lon-lat'
interface RawRoute {
  coordinates: unknown
  order: Order
  name?: string
  oneWay?: boolean
}
interface PolylineFile {
  routes: RawRoute[]
  unsupported: number
}
export interface PreviewRoute {
  positions: LatLon[]
  name: string
  oneWay: boolean
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const coordinate = (value: unknown): boolean =>
  Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number'

export function readPolylineFile(raw: unknown): PolylineFile {
  const routes: RawRoute[] = []
  let unsupported = 0

  const visit = (value: unknown, name?: string, oneWay?: boolean): void => {
    if (Array.isArray(value)) {
      if (value.some(coordinate)) routes.push({ coordinates: value, order: 'lat-lon', name, oneWay })
      else value.forEach((entry) => visit(entry))
      return
    }
    if (!record(value)) {
      unsupported++
      return
    }
    if (value.type === 'FeatureCollection' && Array.isArray(value.features)) {
      value.features.forEach((feature) => visit(feature))
    } else if (value.type === 'Feature') {
      visit(value.geometry, record(value.properties) && typeof value.properties.name === 'string' ? value.properties.name : undefined)
    } else if (value.type === 'LineString') {
      routes.push({ coordinates: value.coordinates, order: 'lon-lat', name })
    } else if (value.type === 'MultiLineString' && Array.isArray(value.coordinates)) {
      value.coordinates.forEach((coordinates) => routes.push({ coordinates, order: 'lon-lat', name }))
    } else if (Array.isArray(value.polyline)) {
      routes.push({
        coordinates: value.polyline,
        order: 'lat-lon',
        name: typeof value.name === 'string' ? value.name : name,
        oneWay: value.is_one_way === true,
      })
    } else if (Array.isArray(value.polylines)) {
      visit(value.polylines)
    } else if (Array.isArray(value.connections)) {
      visit(value.connections)
    } else {
      unsupported++
    }
  }
  visit(raw)
  return { routes, unsupported }
}

export function previewPolylines(file: PolylineFile, swapped: boolean, formatName: Messages['upload']['route']): { routes: PreviewRoute[]; invalid: number } {
  const routes: PreviewRoute[] = []
  let invalid = file.unsupported
  file.routes.forEach((route, index) => {
    if (!Array.isArray(route.coordinates) || route.coordinates.length < 2 || route.coordinates.length > 2000) {
      invalid++
      return
    }
    const flip = (route.order === 'lon-lat') !== swapped
    const positions: LatLon[] = []
    for (const pair of route.coordinates) {
      if (!Array.isArray(pair)) break
      const lat: unknown = pair[flip ? 1 : 0]
      const lon: unknown = pair[flip ? 0 : 1]
      if (!validCoordinate(lat, lon) || typeof lon !== 'number') break
      positions.push([lat, lon])
    }
    const distinct = new Set(positions.map(coordinateKey)).size
    const closed = positions.length > 0 && coordinateKey(positions[0]) === coordinateKey(positions[positions.length - 1])
    if (positions.length !== route.coordinates.length || distinct < (closed ? 3 : 2)) {
      invalid++
      return
    }
    routes.push({ positions, name: route.name?.trim().slice(0, 100) || formatName(index + 1), oneWay: route.oneWay ?? false })
  })
  return { routes, invalid }
}

export function polylinesToDraft(routes: PreviewRoute[], names: Pick<Messages['upload'], 'start' | 'end' | 'point'>): AreaDraft {
  const points: AreaDraft['points'] = []
  const links: AreaDraft['links'] = []
  const byCoordinate = new Map<string, number>()
  const pairs = new Set<string>()

  const addPoint = (coordinates: LatLon, name: string): number => {
    const key = coordinateKey(coordinates)
    const existing = byCoordinate.get(key)
    if (existing !== undefined) return existing
    const index = points.length
    byCoordinate.set(key, index)
    points.push({ name, coordinates, speedLimitKmh: DEFAULT_SPEED_LIMIT })
    return index
  }
  const pairKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`

  for (const { positions, name, oneWay } of routes) {
    const from = addPoint(positions[0], names.start(name))
    const to = addPoint(positions[positions.length - 1], names.end(name))
    const anchors = [{ index: 0, point: from }]
    if (from === to || pairs.has(pairKey(from, to))) {
      // A closed line needs two intermediate points. A parallel line needs one
      // so the API can retain its shape without accepting duplicate endpoint pairs.
      const needed = from === to ? 2 : 1
      const candidates = positions.slice(1, -1).flatMap((coordinate, index) =>
        byCoordinate.has(coordinateKey(coordinate)) && from !== to ? [] : [{ coordinate, index: index + 1 }])
      for (const candidate of candidates) {
        const point = addPoint(candidate.coordinate, names.point(name, anchors.length + 1))
        if (point === to || anchors.some((anchor) => anchor.point === point)) continue
        anchors.push({ index: candidate.index, point })
        if (anchors.length > needed) break
      }
    }
    anchors.push({ index: positions.length - 1, point: to })
    for (let i = 1; i < anchors.length; i++) {
      const a = anchors[i - 1]
      const b = anchors[i]
      const key = pairKey(a.point, b.point)
      if (a.point === b.point || pairs.has(key)) continue
      pairs.add(key)
      links.push({ from: a.point, to: b.point, geometryMode: 'manual', isOneWay: oneWay, polyline: positions.slice(a.index, b.index + 1) })
    }
  }
  return { points, links }
}
