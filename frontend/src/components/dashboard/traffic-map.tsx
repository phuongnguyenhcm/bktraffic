import { useEffect, useEffectEvent, useMemo } from 'react'
import { CircleMarker, MapContainer, Polyline, Tooltip, ZoomControl, useMap } from 'react-leaflet'
import { latLngBounds } from 'leaflet'
import ThemedBasemap from '@/components/map/themed-basemap'
import type { MapEdge, MapNode } from '@/types/traffic'
import { STATUS_META, formatSpeed, pct } from '@/lib/traffic'

/** Fit toàn mạng lưới lần đầu, bay tới node khi được chọn */
function ViewController({ nodes, selected }: { nodes: MapNode[]; selected: MapNode | undefined }) {
  const map = useMap()
  const boundsKey = nodes.map(({ lat, lon }) => `${lat},${lon}`).join('|')
  const fitNetwork = useEffectEvent(() => {
    if (nodes.length) {
      const bounds = latLngBounds(nodes.map(({ lat, lon }) => [lat, lon]))
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 })
    }
  })
  const lat = selected?.lat
  const lon = selected?.lon

  useEffect(() => {
    fitNetwork()
  }, [boundsKey, map])

  useEffect(() => {
    if (lat !== undefined && lon !== undefined) {
      map.panTo([lat, lon], { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches })
    }
  }, [lat, lon, map])
  return null
}

interface Props {
  nodes: MapNode[]
  edges: MapEdge[]
  selectedId: string | null
  focusId?: string
  onSelect: (id: string) => void
}

export default function TrafficMap({ nodes, edges, selectedId, focusId, onSelect }: Props) {
  const selected = nodes.find((n) => n.id === focusId)
  const nodeName = useMemo(() => new Map(nodes.map((n) => [n.id, n.name])), [nodes])
  const center: [number, number] = nodes[0] ? [nodes[0].lat, nodes[0].lon] : [10.7726, 106.6634]

  return (
    <MapContainer id="traffic-map" center={center} zoom={15} className="traffic-map size-full" zoomControl={false} scrollWheelZoom={false}>
      <ThemedBasemap />
      <ZoomControl position="topright" />

      {/* Lớp glow */}
      {edges.map((e) => {
        const active = !!selectedId && (e.fromNodeId === selectedId || e.toNodeId === selectedId)
        return (
          <Polyline
            key={`${e.id}-glow`}
            positions={e.polyline}
            pathOptions={{ color: STATUS_META[e.status].color, weight: active ? 16 : 11, opacity: active ? 0.35 : 0.15, lineCap: 'round' }}
            interactive={false}
          />
        )
      })}

      {/* Lớp chính */}
      {edges.map((e) => {
        const m = STATUS_META[e.status]
        const active = !!selectedId && (e.fromNodeId === selectedId || e.toNodeId === selectedId)
        return (
          <Polyline
            key={e.id}
            positions={e.polyline}
            pathOptions={{
              color: m.color,
              weight: active ? 7 : 5,
              opacity: selectedId && !active ? 0.55 : 1,
              lineCap: 'round',
            }}
            eventHandlers={{ click: () => onSelect(e.fromNodeId) }}
          >
            <Tooltip sticky className="seg-tip">
              <div className="text-xs">
                <p className="font-semibold">
                  {nodeName.get(e.fromNodeId)} {e.isOneWay ? '→' : '↔'} {nodeName.get(e.toNodeId)}
                </p>
                <p data-traffic-status={e.status} className="traffic-text">
                  {m.shortLabel}{e.status !== 'UNKNOWN' && ` · ${pct(e.predictedSpeedRatio)} · ${formatSpeed(e.predictedSpeedKmh)} km/h`}
                </p>
              </div>
            </Tooltip>
          </Polyline>
        )
      })}

      {nodes.map((node) => node.polyline && (
        <Polyline
          key={node.id}
          positions={node.polyline}
          pathOptions={{ color: STATUS_META[node.status].color, weight: node.id === selectedId ? 7 : 5 }}
          eventHandlers={{ click: () => onSelect(node.id) }}
        />
      ))}

      {/* Node markers */}
      {nodes.map((n) => {
        const m = STATUS_META[n.status]
        const active = n.id === selectedId
        return (
          <CircleMarker
            key={n.id}
            center={[n.lat, n.lon]}
            radius={active ? 11 : 8}
            pathOptions={{ color: active ? 'var(--foreground)' : 'var(--card)', weight: active ? 3 : 2, fillColor: m.color, fillOpacity: 1 }}
            eventHandlers={{ click: () => onSelect(n.id) }}
          >
            <Tooltip direction="top" offset={[0, -8]} className="seg-tip">
              <div className="text-xs">
                <p className="font-semibold">{n.name}</p>
                <p data-traffic-status={n.status} className="traffic-text">
                  {m.shortLabel}{n.status !== 'UNKNOWN' && ` · ${pct(n.predictedSpeedRatio)} · ${formatSpeed(n.predictedSpeedKmh)} km/h`}
                </p>
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}

      <ViewController nodes={nodes} selected={selected} />
    </MapContainer>
  )
}
