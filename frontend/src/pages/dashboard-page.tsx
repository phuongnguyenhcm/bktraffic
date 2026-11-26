import { useLanguage } from '@/i18n/use-language'
import { useState } from 'react'
import { MapPinned, MousePointerClick } from 'lucide-react'
import type { PredictionHorizon } from '@/types/traffic'
import { fetchTrafficMap } from '@/services/api'
import { useAsync } from '@/hooks/use-async'
import { formatDateTime } from '@/lib/traffic'
import TrafficMap from '@/components/dashboard/traffic-map'
import NodeList from '@/components/dashboard/node-list'
import NodeDetailPanel from '@/components/dashboard/node-detail-panel'
import HorizonSelector from '@/components/dashboard/horizon-selector'
import ErrorState from '@/components/common/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'

const REFRESH_MS = 30_000
const SUMMARY = { clear: 'CLEAR', moderate: 'MODERATE', congested: 'CONGESTED' } as const
const SUMMARY_KEYS = ['clear', 'moderate', 'congested'] as const

function MapPlaceholder() {
  const { messages } = useLanguage()
  return (
    <div role="status" className="grid size-full place-items-center bg-muted p-5">
      <Skeleton className="grid size-full place-items-center rounded-xl">
        <span className="rounded-lg bg-background px-4 py-2 text-sm text-foreground">{messages.traffic.loadingMap}</span>
      </Skeleton>
    </div>
  )
}

function DetailPlaceholder() {
  const { messages } = useLanguage()
  return (
    <div role="status" className="space-y-4 p-5" aria-label={messages.traffic.loadingDetail}>
      <Skeleton className="h-7 w-3/5" />
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export default function DashboardPage() {
  const { messages, locale } = useLanguage()
  const [horizon, setHorizon] = useState<PredictionHorizon>(10)
  const [selection, setSelection] = useState<string | null>()
  const [showTopologyLinks, setShowTopologyLinks] = useState(false)
  const map = useAsync((signal) => fetchTrafficMap(horizon, signal), horizon, REFRESH_MS)

  const current = map.data?.horizonMinutes === horizon ? map.data : null
  const selected = selection === undefined
    ? current?.nodes[0]
    : current?.nodes.find((node) => node.id === selection)
  const selectedId = selected?.id ?? null

  return (
    <div className="space-y-5 py-6 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{messages.nav.traffic}</h1>
          {current?.dataTimestamp && (
            <p className="mt-1 text-sm text-muted-foreground">
              {messages.traffic.sensorTime(formatDateTime(current.dataTimestamp, locale))}
            </p>
          )}
        </div>
        <HorizonSelector value={horizon} onChange={setHorizon} loading={map.loading} />
      </header>

      {map.error && current && (
        <div role="status" data-traffic-status="MODERATE" className="traffic-surface traffic-text flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm">
          <span>{messages.traffic.forecastRefreshError}</span>
          <button className="font-semibold underline underline-offset-4" onClick={map.reload}>{messages.common.retry}</button>
        </div>
      )}

      {current && current.nodes.length === 0 ? (
        <section role="status" className="glass grid min-h-72 place-items-center px-6 py-10 text-center">
          <div>
            <MapPinned className="mx-auto mb-4 size-8 text-primary" aria-hidden />
            <h2 className="text-lg font-semibold text-foreground">{messages.traffic.noAgentRoads}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{messages.traffic.roadsAfterConfig}</p>
          </div>
        </section>
      ) : (

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(330px,38%)]">
          <div className="min-w-0 space-y-4">
            <section className="glass overflow-hidden" aria-labelledby="traffic-map-title" aria-busy={map.loading}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h2 id="traffic-map-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MapPinned className="size-4 text-primary" /> {messages.traffic.map}
                </h2>
                <dl className="flex flex-wrap gap-x-4 gap-y-2">
                  {SUMMARY_KEYS.map((status) => (
                    <div key={status} data-traffic-status={SUMMARY[status]} className="flex items-center gap-1.5 text-xs">
                      <dt className="text-muted-foreground">{messages.traffic[SUMMARY[status]]}</dt>
                      <dd className="traffic-text font-semibold tabular-nums">
                        {current ? current.summary[status] : map.loading ? <Skeleton className="h-3.5 w-4" /> : '—'}
                      </dd>
                    </div>
                  ))}
                </dl>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                  <Switch size="sm" checked={showTopologyLinks} onCheckedChange={setShowTopologyLinks} />
                  {messages.traffic.showTopologyLinks}
                </label>
              </div>
              <div className="relative isolate h-[clamp(340px,54vh,620px)]">
                {map.data && (
                  <div className={current ? 'size-full' : 'invisible size-full'} aria-hidden={!current}>
                    <TrafficMap nodes={map.data.nodes} edges={map.data.edges} showTopologyLinks={showTopologyLinks} selectedId={selectedId} focusId={selection ?? undefined} onSelect={setSelection} />
                  </div>
                )}
                {!current && (
                  <div className="absolute inset-0">
                    {map.loading
                      ? <MapPlaceholder />
                      : <div className="grid size-full place-items-center"><ErrorState message={map.error ?? messages.traffic.noMapData} onRetry={map.reload} /></div>}
                  </div>
                )}
              </div>
            </section>
            {(current || map.loading) && (
              <NodeList nodes={current?.nodes ?? null} loading={map.loading} selectedId={selectedId} onSelect={setSelection} />
            )}
          </div>

          <aside id="prediction-panel" aria-label={messages.traffic.detail} className="glass min-w-0 overflow-hidden" aria-busy={map.loading && !current}>
            {selected ? (
              <NodeDetailPanel key={selected.id} node={selected} horizon={horizon} onClose={() => setSelection(null)} />
            ) : !current ? (
              map.loading ? <DetailPlaceholder /> : (
                <p className="p-6 text-sm text-muted-foreground">{messages.traffic.waitingForMap}</p>
              )
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="grid size-14 place-items-center rounded-2xl border border-primary/30 bg-primary/10">
                  <MousePointerClick className="size-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {messages.traffic.choosePoint}
                  </h2>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                    {messages.traffic.choosePointHint}
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
