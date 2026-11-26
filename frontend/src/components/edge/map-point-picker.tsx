import { useLanguage } from '@/i18n/use-language'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Check, Loader2, MapPinPlus } from 'lucide-react'
import { Polyline } from 'react-leaflet'
import AreaMap from '@/components/edge/area-map'
import PlaceSearch from '@/components/edge/place-search'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AreaDraft, MonitoringPoint } from '@/lib/edge-setup'
import { resolveRoadSegment, toErrorMessage } from '@/services/api'
import type { LatLon, ResolvedSegment } from '@/types/traffic'

interface Props {
  onApply: (area: AreaDraft) => string | null
  onClose: () => void
  points: MonitoringPoint[]
}

export default function MapPointPicker({ onApply, onClose, points }: Props) {
  const { messages } = useLanguage()
  const [pin, setPin] = useState<LatLon | null>(null)
  const [destination, setDestination] = useState<LatLon>()
  const [segment, setSegment] = useState<ResolvedSegment | null>(null)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [speed, setSpeed] = useState('')
  const [failure, setFailure] = useState<{ error: unknown } | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [lastAdded, setLastAdded] = useState('')
  const request = useRef<AbortController | null>(null)

  useEffect(() => () => request.current?.abort(), [])

  const pick = async (coordinates: LatLon) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller

    setPin(coordinates)
    setSegment(null)
    setSpeed('')
    setFailure(null)
    setApplyError(null)
    setLastAdded('')
    setLoading(true)

    try {
      const selected = await resolveRoadSegment(coordinates, controller.signal)
      if (controller.signal.aborted) return
      setSegment(selected)
      setPin([selected.lat, selected.lon])
      setSpeed(String(selected.speedLimitKmh))
    } catch (reason) {
      if (!controller.signal.aborted) setFailure({ error: reason })
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const speedLimitKmh = Number(speed)
  const validSpeed = Number.isInteger(speedLimitKmh) && speedLimitKmh >= 5 && speedLimitKmh <= 150

  const addSegment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const pointName = name.trim()
    if (!segment || !pointName || !validSpeed || loading) return

    const error = onApply({
      points: [{ name: pointName, coordinates: [segment.lat, segment.lon], speedLimitKmh, polyline: segment.polyline }],
      links: [],
    })
    if (error) {
      setApplyError(error)
      return
    }

    setLastAdded(pointName)
    setName('')
    setSpeed('')
    setPin(null)
    setSegment(null)
    setFailure(null)
    setApplyError(null)
  }

  const error = failure ? toErrorMessage(failure.error, messages.api) : applyError

  return (
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-3">
        <PlaceSearch onSelect={({ lat, lon }) => setDestination([lat, lon])} />
        <AreaMap id="area-picker-map" label={messages.picker.map} className="h-full min-h-[500px] flex-1"
          initialCenter={points[0]?.coordinates} onPick={pick} pin={pin} destination={destination}>
          {points.map(({ id, polyline }) => polyline && (
            <Polyline key={id} positions={polyline} interactive={false}
              pathOptions={{ color: 'var(--primary)', weight: 4, opacity: 0.55 }} />
          ))}
          {segment && (
            <>
              <Polyline positions={segment.polyline} interactive={false}
                pathOptions={{ color: 'var(--background)', weight: 10 }} />
              <Polyline positions={segment.polyline} interactive={false}
                pathOptions={{ color: 'var(--primary)', weight: 6 }} />
            </>
          )}
        </AreaMap>
      </div>
      <form className="flex min-w-0 flex-col gap-3" onSubmit={addSegment}>
        {!pin && !lastAdded && (
          <div className="rounded-xl border border-dashed border-border bg-muted/50 p-4">
            <MapPinPlus className="mb-2 size-5 text-primary" aria-hidden />
            <p className="font-medium text-foreground">{messages.picker.empty}</p>
            <p className="mt-1 text-sm text-muted-foreground">{messages.picker.emptyHint}</p>
          </div>
        )}
        {loading && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> {messages.picker.loading}
          </p>
        )}
        {segment && (
          <>
            <div role="status" className="rounded-lg border border-border bg-muted px-3 py-2">
              <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Check className="size-4 text-primary" aria-hidden /> {messages.picker.found}
              </p>
              <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                {segment.lat.toFixed(6)}, {segment.lon.toFixed(6)}
              </p>
            </div>
            <label className="grid gap-1.5 text-sm font-medium">
              {messages.picker.name}
              <Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120}
                placeholder={messages.picker.namePlaceholder} className="bg-background" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              {messages.picker.speed}
              <Input type="number" inputMode="numeric" min={5} max={150} step={1} required value={speed}
                onChange={(event) => setSpeed(event.target.value)} className="bg-background" />
            </label>
            <Button type="submit" disabled={!name.trim() || !validSpeed}>
              <MapPinPlus /> {messages.picker.add}
            </Button>
          </>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {lastAdded && (
          <p role="status" className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {messages.picker.added(lastAdded)}
          </p>
        )}
        <Button type="button" variant="outline" className="mt-auto self-start" onClick={onClose}>{messages.common.close}</Button>
      </form>
    </div>
  )
}
