import { useEffect, type ReactNode } from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import ThemedBasemap from '@/components/map/themed-basemap'
import type { LatLon } from '@/types/traffic'

const DEFAULT_CENTER: LatLon = [10.7726, 106.6634]
const pinIcon = divIcon({ className: 'area-map-pin', iconSize: [18, 18], iconAnchor: [9, 15] })

function MapEvents({ onPick, fit, destination }: { onPick?: (point: LatLon) => void; fit?: LatLon[]; destination?: LatLon }) {
  const map = useMap()
  useMapEvents({
    click: ({ latlng }) => {
      const { lat, lng } = latlng.wrap()
      onPick?.([lat, lng])
    },
  })
  useEffect(() => {
    const invalidateSize = () => map.invalidateSize({ pan: false })
    const frame = requestAnimationFrame(invalidateSize)
    const observer = new ResizeObserver(invalidateSize)
    observer.observe(map.getContainer())
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [map])
  useEffect(() => {
    if (fit?.length) map.fitBounds(fit, { padding: [20, 20], maxZoom: 17, animate: false })
  }, [fit, map])
  useEffect(() => {
    if (destination) {
      const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      map.flyTo(destination, 17, { animate })
    }
  }, [destination, map])
  return null
}

interface Props {
  id: string
  label: string
  className?: string
  onPick?: (point: LatLon) => void
  initialCenter?: LatLon
  fit?: LatLon[]
  destination?: LatLon
  pin?: LatLon | null
  children?: ReactNode
}

export default function AreaMap({ id, label, className, onPick, initialCenter, fit, destination, pin, children }: Props) {
  return (
    <div role="region" aria-label={label} className={`isolate overflow-hidden rounded-xl border border-border ${className ?? 'h-[60vh] min-h-[480px]'}`}>
      <MapContainer id={id} center={initialCenter ?? DEFAULT_CENTER} zoom={15} zoomControl={false} scrollWheelZoom
        className={`traffic-map size-full ${onPick ? 'cursor-crosshair' : ''}`}>
        <ThemedBasemap />
        <ZoomControl position="topright" />
        <MapEvents onPick={onPick} fit={fit} destination={destination} />
        {pin && <Marker position={pin} icon={pinIcon} keyboard={false} interactive={false} />}
        {children}
      </MapContainer>
    </div>
  )
}
