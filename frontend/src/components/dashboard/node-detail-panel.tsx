import { lazy, Suspense } from 'react'
import { AlertOctagon, AlertTriangle, CheckCircle2, Gauge, MapPin, ShieldCheck, Activity, X, type LucideIcon } from 'lucide-react'
import type { MapNode, PredictionHorizon } from '@/types/traffic'
import { fetchNodeHistory } from '@/services/api'
import { useAsync } from '@/hooks/use-async'
import { HORIZON_LABEL, STATUS_META, formatClock, pct, statusFromRatio } from '@/lib/traffic'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import StatusBadge from '@/components/common/status-badge'
import ErrorState from '@/components/common/error-state'

const ForecastChart = lazy(() => import('./forecast-chart'))

const REFRESH_MS = 30_000
const BANNER_ICON = { CLEAR: CheckCircle2, MODERATE: AlertTriangle, CONGESTED: AlertOctagon } as const

function Kpi({ icon: Icon, label, value, sub, color }: { icon: LucideIcon; label: string; value: string; sub: string; color: string }) {
  return (
    <Card size="sm" className="gap-1 bg-ink-950/60 py-3 ring-white/8">
      <CardContent className="px-3">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="size-3.5" />
          <span className="eyebrow text-[10px]">{label}</span>
        </div>
        <p className="mt-1.5 text-2xl font-bold" style={{ color }}>
          {value}
        </p>
        <p className="text-[11px] text-slate-500">{sub}</p>
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
  const history = useAsync((signal) => fetchNodeHistory(node.id, signal), node.id, REFRESH_MS)
  const meta = STATUS_META[node.status]
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
            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-slate-300">node #{node.index}</span>
          </div>
          <h2 className="mt-2 text-xl leading-tight font-bold text-white">{node.name}</h2>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="size-3" /> {node.lat.toFixed(5)}, {node.lon.toFixed(5)} · giới hạn {node.speedLimitKmh} km/h
          </p>
        </div>
        <Button id="panel-close" variant="outline" size="icon" onClick={onClose} aria-label="Đóng">
          <X />
        </Button>
      </div>

      {/* Banner cảnh báo */}
      <div
        id="congestion-banner"
        className="flex items-start gap-3 rounded-2xl border p-4"
        style={{ borderColor: `${meta.color}55`, background: `linear-gradient(135deg, ${meta.color}26, ${meta.color}08)` }}
      >
        <BannerIcon className="mt-0.5 size-6 shrink-0" style={{ color: meta.color }} />
        <div>
          <p className="font-semibold" style={{ color: meta.color }}>
            {meta.label} trong {HORIZON_LABEL[horizon]} tới
          </p>
          <p className="mt-0.5 text-sm text-slate-300">{meta.description}</p>
          <p className="mt-1 text-xs text-slate-400">
            Hiện tại: <span style={{ color: STATUS_META[currentStatus].color }}>{STATUS_META[currentStatus].shortLabel} ({pct(node.currentSpeedRatio)})</span>
            {' · '}xu hướng{' '}
            <span className={delta >= 0 ? 'text-clear' : 'text-congested'}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta * 100))}%
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <Kpi icon={Activity} label="Mức độ lưu thông" value={pct(node.predictedSpeedRatio)} sub={`hiện tại ${pct(node.currentSpeedRatio)}`} color={meta.color} />
        <Kpi icon={Gauge} label="Vận tốc dự báo" value={`${node.predictedSpeedKmh}`} sub={`km/h · hiện ${node.currentSpeedKmh}`} color="#e2e8f0" />
        <Kpi icon={ShieldCheck} label="Độ tin cậy" value={pct(node.confidence)} sub={`+${horizon} phút`} color={node.confidence >= 0.75 ? '#10B981' : '#F59E0B'} />
      </div>

      <Card className="gap-3 bg-ink-950/60 py-4 ring-white/8">
        <CardContent className="px-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Lịch sử và dự báo vận tốc</h3>
            {lastSample && (
              <p className="text-[11px] text-slate-500">
                Mẫu cuối {formatClock(lastSample.timestamp)}
              </p>
            )}
          </div>
          {history.error && history.data && (
            <p role="status" className="mb-2 text-xs text-moderate">
              Làm mới lịch sử thất bại. <button className="underline" onClick={history.reload}>Thử lại</button>
            </p>
          )}
          <div className="h-64" aria-busy={history.loading}>
            {history.error && !history.data ? (
              <ErrorState compact message={history.error} onRetry={history.reload} />
            ) : history.data ? (
              <Suspense fallback={<Skeleton className="size-full rounded-xl" />}>
                <ForecastChart data={history.data} selectedHorizon={horizon} />
              </Suspense>
            ) : (
              <Skeleton className="size-full rounded-xl" />
            )}
          </div>
          {history.data && (
            <>
              <Separator className="my-3 bg-white/5" />
              <div className="grid grid-cols-4 gap-2 text-center">
                {history.data.forecasts.map((f) => {
                  const m = STATUS_META[f.status]
                  const on = f.horizonMinutes === horizon
                  return (
                    <div key={f.horizonMinutes} className={`rounded-lg py-1.5 ${on ? 'bg-white/10 ring-1 ring-brand/40' : 'bg-white/[0.03]'}`}>
                      <p className="text-[10px] text-slate-500">+{HORIZON_LABEL[f.horizonMinutes]}</p>
                      <p className="text-sm font-bold" style={{ color: m.color }}>
                        {pct(f.predictedSpeedRatio)}
                      </p>
                      <p className="text-[10px] text-slate-400">{f.predictedSpeedKmh} km/h</p>
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
