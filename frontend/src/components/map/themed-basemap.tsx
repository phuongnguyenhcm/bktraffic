import { useState } from 'react'
import { TileLayer } from 'react-leaflet'
import { useTheme } from '@/hooks/use-theme'

const cartoKey = import.meta.env.VITE_CARTO_API_KEY?.trim()
const fallbackUrl = import.meta.env.VITE_MAP_TILE_URL?.trim() || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const osmAttribution = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const cartoAttribution = `${osmAttribution}, © <a href="https://carto.com/attribution/">CARTO</a>`

function Basemap({ url }: { url: string }) {
  const [tileStatus, setTileStatus] = useState<'loading' | 'loaded' | 'error'>('loading')

  return (
    <>
      <TileLayer
        attribution={cartoKey ? cartoAttribution : osmAttribution}
        url={url}
        subdomains="abcd"
        maxNativeZoom={20}
        eventHandlers={{
          tileload: () => setTileStatus('loaded'),
          tileerror: () => setTileStatus((status) => status === 'loaded' ? status : 'error'),
        }}
      />
      {tileStatus === 'error' && (
        <p role="status" className="pointer-events-none absolute bottom-6 left-3 z-[500] m-0 max-w-[calc(100%-1.5rem)] rounded-lg border border-border bg-popover px-3 py-1.5 text-xs text-muted-foreground">
          Chưa tải được nền bản đồ. Các tuyến và điểm dự báo vẫn hiển thị.
        </p>
      )}
    </>
  )
}

export default function ThemedBasemap() {
  const { resolvedTheme } = useTheme()
  const tileUrl = cartoKey
    ? `https://{s}.basemaps.cartocdn.com/${resolvedTheme}_all/{z}/{x}/{y}{r}.png?api_key=${encodeURIComponent(cartoKey)}`
    : fallbackUrl

  return <Basemap key={tileUrl} url={tileUrl} />
}
