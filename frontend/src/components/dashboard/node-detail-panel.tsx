import { useLanguage } from '@/i18n/use-language'
import { lazy, Suspense } from 'react'
import { AlertOctagon, AlertTriangle, CheckCircle2, CircleHelp, Gauge, MapPin, ShieldCheck, Activity, X, type LucideIcon } from 'lucide-react'
import type { MapNode, PredictionHorizon, TrafficStatus } from '@/types/traffic'
import { fetchNodeHistory } from '@/services/api'
import { useAsync } from '@/hooks/use-async'
import { formatSpeed, formatClock, pct, statusFromRatio } from '@/lib/traffic'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import StatusBadge from '@/components/common/status-badge'
import ErrorState from '@/components/common/error-state'

const ForecastChart = lazy(() => import('./forecast-chart'))

const REFRESH_MS = 30_000
const BANNER_ICON = { CLEAR: CheckCircle2, MODERATE: AlertTriangle, CONGESTED: AlertOctagon, UNKNOWN: CircleHelp } as const

function Kpi({ icon: Icon, label, value, sub, status }: { icon: LucideIcon; label: string; value: string; sub: string; status?: TrafficStatus }) {
  return (
    <Card size="sm" className="gap-1 bg-muted py-3 ring-border">
      <CardContent className="px-3">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="size-3.5" />
          <span className="eyebrow text-[10px]">{label}</span>
        </div>
        <p data-traffic-status={status} className={`mt-1.5 text-2xl font-bold ${status ? 'traffic-text' : 'text-foreground'}`}>
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}

interface Props {
  node: MapNode
  horizon: PredictionHorizon
  onClose: () => void
}

export default function NodeDetailPanel({ node, horizon, onClose }: Props) {
  const { messages, locale } = useLanguage()
  const history = useAsync((signal) => fetchNodeHistory(node.id, signal), node.id, REFRESH_MS)
  const status = messages.traffic[node.status]
  const description = {
    CLEAR: messages.traffic.clearDescription,
    MODERATE: messages.traffic.moderateDescription,
    CONGESTED: messages.traffic.congestedDescription,
    UNKNOWN: messages.traffic.unknownDescription,
  }[node.status]
  const duration = messages.traffic.minutes(horizon)
  const hasPrediction = node.status !== 'UNKNOWN'
  const BannerIcon = BANNER_ICON[node.status]
  const currentStatus = statusFromRatio(node.currentSpeedRatio)
  const delta = node.predictedSpeedRatio - node.currentSpeedRatio
  const lastSample = history.data?.history.at(-1)

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={node.status} />
            <span className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">{messages.traffic.node(node.index)}</span>
          </div>
          <h2 className="mt-2 text-xl leading-tight font-bold text-foreground">{node.name}</h2>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" /> {node.lat.toFixed(5)}, {node.lon.toFixed(5)} · {messages.traffic.limit(node.speedLimitKmh)} km/h
          </p>
        </div>
        <Button id="panel-close" variant="outline" size="icon" onClick={onClose} aria-label={messages.common.close}>
          <X />
        </Button>
      </div>

      {/* Banner cảnh báo */}
      <div
        id="congestion-banner"
        data-traffic-status={node.status}
        className="traffic-surface flex items-start gap-3 rounded-2xl border p-4"
      >
        <BannerIcon className="traffic-text mt-0.5 size-6 shrink-0" />
        <div>
          <p className="traffic-text font-semibold">
            {hasPrediction ? messages.traffic.forecastStatus(status, duration) : status}
          </p>
          <p className="mt-0.5 text-sm text-foreground">{description}</p>
          {hasPrediction && <p className="mt-1 text-xs text-muted-foreground">
            {messages.traffic.current}: <span data-traffic-status={currentStatus} className="traffic-text">{messages.traffic[currentStatus]} ({pct(node.currentSpeedRatio)})</span>
            {' · '}{messages.traffic.trend}{' '}
            <span className={delta >= 0 ? 'text-clear' : 'text-congested'}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta * 100))}%
            </span>
          </p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Kpi icon={Activity} label={messages.traffic.flow} value={hasPrediction ? pct(node.predictedSpeedRatio) : '—'} sub={hasPrediction ? messages.traffic.currentSummary(pct(node.currentSpeedRatio)) : '%'} status={node.status} />
        <Kpi icon={Gauge} label={messages.traffic.predictedSpeed} value={hasPrediction ? formatSpeed(node.predictedSpeedKmh, locale) : '—'} sub={hasPrediction ? `km/h · ${messages.traffic.currentSummary(formatSpeed(node.currentSpeedKmh, locale))}` : 'km/h'} />
        <Kpi icon={ShieldCheck} label={messages.traffic.confidence} value={hasPrediction ? pct(node.confidence) : '—'} sub={`+${duration}`} status={hasPrediction ? (node.confidence >= 0.75 ? 'CLEAR' : 'MODERATE') : 'UNKNOWN'} />
      </div>

      <Card className="gap-3 bg-muted py-4 ring-border">
        <CardContent className="px-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2">
            <h3 className="text-sm font-semibold text-foreground">{messages.traffic.speedHistory}</h3>
            {lastSample && (
              <p className="text-[11px] text-muted-foreground">
                {messages.traffic.lastSample(formatClock(lastSample.timestamp, locale))}
              </p>
            )}
          </div>
          {history.error && history.data && (
            <p role="status" className="mb-2 text-xs text-moderate">
              {messages.traffic.historyRefreshError} <button className="underline" onClick={history.reload}>{messages.common.retry}</button>
            </p>
          )}
          <div className="h-64" aria-busy={history.loading}>
            {history.error && !history.data ? (
              <ErrorState compact message={history.error} onRetry={history.reload} />
            ) : history.data ? (
              history.data.history.length || history.data.forecasts.some((forecast) => forecast.status !== 'UNKNOWN') ? (
                <Suspense fallback={<Skeleton className="size-full rounded-xl" />}>
                  <ForecastChart data={history.data} selectedHorizon={horizon} />
                </Suspense>
              ) : (
                <p className="grid h-full place-items-center text-sm text-muted-foreground">{messages.traffic.noSpeedData}</p>
              )
            ) : (
              <Skeleton className="size-full rounded-xl" />
            )}
          </div>
          {history.data && (
            <>
              <Separator className="my-3 bg-muted" />
              <div className="grid grid-cols-4 gap-2 text-center">
                {history.data.forecasts.map((f) => {
                  const on = f.horizonMinutes === horizon
                  return (
                    <div key={f.horizonMinutes} className={`rounded-lg py-1.5 ${on ? 'bg-accent ring-1 ring-primary/40' : 'bg-muted/60'}`}>
                      <p className="text-[10px] text-muted-foreground">+{messages.traffic.minutes(f.horizonMinutes)}</p>
                      <p data-traffic-status={f.status} className="traffic-text text-sm font-bold">
                        {f.status === 'UNKNOWN' ? '—' : pct(f.predictedSpeedRatio)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{f.status === 'UNKNOWN' ? messages.traffic[f.status] : `${formatSpeed(f.predictedSpeedKmh, locale)} km/h`}</p>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
