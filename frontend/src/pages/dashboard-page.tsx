import { useState } from 'react'
import { MapPinned, MousePointerClick } from 'lucide-react'
import type { PredictionHorizon } from '@/types/traffic'
import { fetchTrafficMap } from '@/services/api'
import { useAsync } from '@/hooks/use-async'
import { STATUS_META, formatDateTime } from '@/lib/traffic'
import TrafficMap from '@/components/dashboard/traffic-map'
import NodeList from '@/components/dashboard/node-list'
import NodeDetailPanel from '@/components/dashboard/node-detail-panel'
import HorizonSelector from '@/components/dashboard/horizon-selector'
import ErrorState from '@/components/common/error-state'
import { Skeleton } from '@/components/ui/skeleton'

const REFRESH_MS = 30_000
const SUMMARY = { clear: 'CLEAR', moderate: 'MODERATE', congested: 'CONGESTED' } as const
const SUMMARY_KEYS = ['clear', 'moderate', 'congested'] as const

function MapPlaceholder() {
  return (
    <div role="status" className="grid size-full place-items-center bg-muted p-5">
      <Skeleton className="grid size-full place-items-center rounded-xl">
        <span className="rounded-lg bg-background px-4 py-2 text-sm text-foreground">Đang tải bản đồ và dự báo…</span>
      </Skeleton>
    </div>
  )
}

function DetailPlaceholder() {
  return (
    <div role="status" className="space-y-4 p-5" aria-label="Đang tải chi tiết dự báo">
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
  const [horizon, setHorizon] = useState<PredictionHorizon>(10)
  const [selection, setSelection] = useState<string | null>()
  const map = useAsync((signal) => fetchTrafficMap(horizon, signal), horizon, REFRESH_MS)

  const current = map.data?.horizonMinutes === horizon ? map.data : null
  const selected = selection === undefined
    ? current?.nodes[0]
    : current?.nodes.find((node) => node.id === selection)
  const selectedId = selected?.id ?? null

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Dự báo giao thông</h1>
          {current?.dataTimestamp && (
            <p className="mt-1 text-sm text-muted-foreground">
              Dữ liệu cảm biến lúc {formatDateTime(current.dataTimestamp)}
            </p>
          )}
        </div>
        <HorizonSelector value={horizon} onChange={setHorizon} loading={map.loading} />
      </header>

      {map.error && current && (
        <div role="status" data-traffic-status="MODERATE" className="traffic-surface traffic-text flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm">
          <span>Làm mới thất bại. Đang hiển thị dữ liệu đã tải cho mốc này.</span>
          <button className="font-semibold underline underline-offset-4" onClick={map.reload}>Thử lại</button>
        </div>
      )}

      {current && current.nodes.length === 0 ? (
        <section role="status" className="glass grid min-h-72 place-items-center px-6 py-10 text-center">
          <div>
            <MapPinned className="mx-auto mb-4 size-8 text-primary" aria-hidden />
            <h2 className="text-lg font-semibold text-foreground">Chưa có Edge Agent nào đăng ký cung đường</h2>
            <p className="mt-2 text-sm text-muted-foreground">Các điểm đo sẽ xuất hiện khi Edge Agent gửi cấu hình.</p>
          </div>
        </section>
      ) : (

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,410px)] xl:grid-cols-[minmax(0,1fr)_minmax(400px,460px)]">
          <div className="min-w-0 space-y-4">
            <section className="glass overflow-hidden" aria-labelledby="traffic-map-title" aria-busy={map.loading}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <h2 id="traffic-map-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MapPinned className="size-4 text-primary" /> Bản đồ giao thông
                </h2>
                <dl className="flex flex-wrap gap-x-4 gap-y-2">
                  {SUMMARY_KEYS.map((status) => (
                    <div key={status} data-traffic-status={SUMMARY[status]} className="flex items-center gap-1.5 text-xs">
                      <dt className="text-muted-foreground">{STATUS_META[SUMMARY[status]].shortLabel}</dt>
                      <dd className="traffic-text font-semibold tabular-nums">
                        {current ? current.summary[status] : map.loading ? <Skeleton className="h-3.5 w-4" /> : '—'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="relative isolate h-[clamp(340px,54vh,620px)]">
                {map.data && (
                  <div className={current ? 'size-full' : 'invisible size-full'} aria-hidden={!current}>
                    <TrafficMap nodes={map.data.nodes} edges={map.data.edges} selectedId={selectedId} focusId={selection ?? undefined} onSelect={setSelection} />
                  </div>
                )}
                {!current && (
                  <div className="absolute inset-0">
                    {map.loading
                      ? <MapPlaceholder />
                      : <div className="grid size-full place-items-center"><ErrorState message={map.error ?? 'Không có dữ liệu bản đồ.'} onRetry={map.reload} /></div>}
                  </div>
                )}
              </div>
            </section>
            {(current || map.loading) && (
              <NodeList nodes={current?.nodes ?? null} loading={map.loading} selectedId={selectedId} onSelect={setSelection} />
            )}
          </div>

          <aside id="prediction-panel" aria-label="Chi tiết dự báo" className="glass min-w-0 overflow-hidden" aria-busy={map.loading && !current}>
            {selected ? (
              <NodeDetailPanel key={selected.id} node={selected} horizon={horizon} onClose={() => setSelection(null)} />
            ) : !current ? (
              map.loading ? <DetailPlaceholder /> : (
                <p className="p-6 text-sm text-muted-foreground">Chi tiết dự báo sẽ xuất hiện khi tải được bản đồ.</p>
              )
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="grid size-14 place-items-center rounded-2xl border border-primary/30 bg-primary/10">
                  <MousePointerClick className="size-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Chọn một điểm giao thông
                  </h2>
                  <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                    Chọn một điểm trên bản đồ hoặc trong danh sách để xem dự báo vận tốc.
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
