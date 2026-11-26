import { useLanguage } from '@/i18n/use-language'
import { useEffect, useEffectEvent, useMemo } from 'react'
import { CircleMarker, MapContainer, Pane, Polyline, Tooltip, ZoomControl, useMap } from 'react-leaflet'
import { latLngBounds } from 'leaflet'
import ThemedBasemap from '@/components/map/themed-basemap'
import type { LatLon, MapEdge, MapNode } from '@/types/traffic'
import { STATUS_META, formatSpeed, pct } from '@/lib/traffic'

/** Fit toàn mạng lưới lần đầu, bay tới node khi được chọn */
function ViewController({ nodes, selected }: { nodes: MapNode[]; selected: MapNode | undefined }) {
  const map = useMap()
  const points = nodes.flatMap<LatLon>(({ lat, lon, polyline }) => [[lat, lon], ...polyline])
  const boundsKey = points.join('|')
  const fitNetwork = useEffectEvent(() => {
    if (points.length) {
      map.fitBounds(latLngBounds(points), { padding: [32, 32], maxZoom: 16 })
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
  showTopologyLinks: boolean
  selectedId: string | null
  focusId?: string
  onSelect: (id: string) => void
}

export default function TrafficMap({ nodes, edges, showTopologyLinks, selectedId, focusId, onSelect }: Props) {
  const { messages, locale } = useLanguage()
  const selected = nodes.find((n) => n.id === focusId)
  const anchors = useMemo(() => new Map<string, LatLon>(nodes.map(({ id, lat, lon }) => [id, [lat, lon]])), [nodes])
  const center: LatLon = nodes[0] ? [nodes[0].lat, nodes[0].lon] : [10.7726, 106.6634]

  return (
    <MapContainer id="traffic-map" center={center} zoom={15} className="traffic-map size-full" zoomControl={false} scrollWheelZoom={false}>
      <ThemedBasemap />
      <ZoomControl key={locale} position="topright" zoomInTitle={messages.common.zoomIn} zoomOutTitle={messages.common.zoomOut} />

      <Pane name="topology-links" style={{ zIndex: 390 }}>
        {showTopologyLinks && edges.map(({ id, fromNodeId, toNodeId }) => {
          const from = anchors.get(fromNodeId)
          const to = anchors.get(toNodeId)
          if (!from || !to) return null
          return (
            <Polyline
              key={id}
              positions={[from, to]}
              pathOptions={{ color: 'var(--muted-foreground)', weight: 2, opacity: 0.65, dashArray: '5 5' }}
              interactive={false}
            />
          )
        })}
      </Pane>

      {[false, true].map((hasForecast) => (
        <Pane key={String(hasForecast)} name={hasForecast ? 'forecast-roads' : 'unknown-roads'} style={{ zIndex: hasForecast ? 410 : 400 }}>
          {nodes.filter((node) => node.polyline.length >= 2 && (node.status !== 'UNKNOWN') === hasForecast).map((node) => (
            <Polyline
              key={node.id}
              positions={node.polyline}
              pathOptions={{ color: STATUS_META[node.status].color, weight: node.id === selectedId ? 6 : 4 }}
              eventHandlers={{ click: () => onSelect(node.id) }}
            />
          ))}
        </Pane>
      ))}

      <Pane name="node-anchors" style={{ zIndex: 420 }}>
        {nodes.map((node) => {
          const active = node.id === selectedId
          return (
            <CircleMarker
              key={node.id}
              center={[node.lat, node.lon]}
              radius={active ? 5 : 4}
              pathOptions={{
                color: active ? 'var(--foreground)' : 'var(--card)',
                weight: 1.5,
                fillColor: STATUS_META[node.status].color,
                fillOpacity: 1,
              }}
              eventHandlers={{ click: () => onSelect(node.id) }}
            >
              <Tooltip pane="tooltipPane" direction="top" offset={[0, -5]} className="seg-tip">
                <div className="text-xs">
                  <p className="font-semibold">{node.name}</p>
                  <p data-traffic-status={node.status} className="traffic-text">
                    {messages.traffic[node.status]}{node.status !== 'UNKNOWN' && ` · ${pct(node.predictedSpeedRatio)} · ${formatSpeed(node.predictedSpeedKmh, locale)} km/h`}
                  </p>
                </div>
              </Tooltip>
            </CircleMarker>
          )
        })}
      </Pane>

      <ViewController nodes={nodes} selected={selected} />
    </MapContainer>
  )
}
