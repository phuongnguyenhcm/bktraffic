import { useLanguage } from '@/i18n/use-language'
import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { MapNode } from '@/types/traffic'
import { formatSpeed, pct } from '@/lib/traffic'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const STATUS_ORDER = { CONGESTED: 0, MODERATE: 1, CLEAR: 2, UNKNOWN: 3 } as const

interface Props {
  nodes: MapNode[] | null
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}

/** Danh sách node — sắp xếp ưu tiên điểm ùn tắc lên đầu (bảng cảnh báo) */
export default function NodeList({ nodes, loading, selectedId, onSelect }: Props) {
  const { messages, locale } = useLanguage()
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase()
    return (nodes ?? [])
      .filter((n) => !k || n.name.toLowerCase().includes(k) || n.id.toLowerCase().includes(k))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.predictedSpeedRatio - b.predictedSpeedRatio)
  }, [nodes, q])

  return (
    <div className="glass flex max-h-full flex-col overflow-hidden">
      <div className="border-b border-border p-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="node-search" aria-label={messages.traffic.searchNodes} value={q} onChange={(e) => setQ(e.target.value)} placeholder={messages.traffic.searchNodesPlaceholder} className="h-9 bg-background pl-9" />
        </label>
      </div>
      <ul className="grid gap-1 p-2 sm:grid-cols-2">
        {loading &&
          !nodes &&
          Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="space-y-2 p-2">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-1/3" />
            </li>
          ))}
        {nodes && filtered.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">{messages.traffic.noMatchingNodes}</li>}
        {filtered.map((n) => {
          const active = n.id === selectedId
          return (
            <li key={n.id}>
              <button
                aria-pressed={active}
                onClick={() => onSelect(n.id)}
                data-traffic-status={n.status}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                  active ? 'bg-accent ring-1 ring-primary/40' : 'hover:bg-muted',
                )}
              >
                <span className="traffic-dot h-8 w-1 shrink-0 rounded-full" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{n.name}</span>
                  <span className="text-xs text-muted-foreground">
                    #{n.index} · {n.status === 'UNKNOWN' ? messages.traffic[n.status] : `${formatSpeed(n.predictedSpeedKmh, locale)} km/h`}
                  </span>
                </span>
                <span className="text-right">
                  <span className="traffic-text block text-base font-bold">
                    {n.status === 'UNKNOWN' ? '—' : pct(n.predictedSpeedRatio)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{messages.traffic.flowShort}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap justify-around gap-2 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        {(['CLEAR', 'MODERATE', 'CONGESTED', 'UNKNOWN'] as const).map((s) => (
          <span key={s} data-traffic-status={s} className="flex items-center gap-1.5">
            <i className="traffic-dot size-2 rounded-full" aria-hidden />
            {messages.traffic[s]}
          </span>
        ))}
      </div>
    </div>
  )
}
