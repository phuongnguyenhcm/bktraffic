import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { MapNode } from '@/types/traffic'
import { STATUS_META, pct } from '@/lib/traffic'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const STATUS_ORDER = { CONGESTED: 0, MODERATE: 1, CLEAR: 2 } as const

interface Props {
  nodes: MapNode[] | null
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}

/** Danh sách node — sắp xếp ưu tiên điểm ùn tắc lên đầu (bảng cảnh báo) */
export default function NodeList({ nodes, loading, selectedId, onSelect }: Props) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase()
    return (nodes ?? [])
      .filter((n) => !k || n.name.toLowerCase().includes(k) || n.id.toLowerCase().includes(k))
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.predictedSpeedRatio - b.predictedSpeedRatio)
  }, [nodes, q])

  return (
    <div className="glass flex max-h-full flex-col overflow-hidden">
      <div className="border-b border-white/5 p-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
          <Input id="node-search" aria-label="Tìm điểm giao thông" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm điểm giao thông…" className="h-9 bg-ink-950/70 pl-9" />
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
        {nodes && filtered.length === 0 && <li className="p-4 text-center text-sm text-slate-500">Không tìm thấy điểm phù hợp</li>}
        {filtered.map((n) => {
          const m = STATUS_META[n.status]
          const active = n.id === selectedId
          return (
            <li key={n.id}>
              <button
                id={`node-item-${n.index}`}
                aria-pressed={active}
                onClick={() => onSelect(n.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                  active ? 'bg-white/10 ring-1 ring-brand/40' : 'hover:bg-white/5',
                )}
              >
                <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: m.color, boxShadow: `0 0 10px ${m.color}` }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white">{n.name}</span>
                  <span className="text-xs text-slate-500">
                    #{n.index} · {n.predictedSpeedKmh} km/h
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-base font-bold" style={{ color: m.color }}>
                    {pct(n.predictedSpeedRatio)}
                  </span>
                  <span className="text-[10px] text-slate-500">lưu thông</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex justify-around border-t border-white/5 px-3 py-2 text-[11px] text-muted-foreground">
        {(['CLEAR', 'MODERATE', 'CONGESTED'] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <i className="size-2 rounded-full" style={{ background: STATUS_META[s].color }} />
            {STATUS_META[s].shortLabel}
          </span>
        ))}
      </div>
    </div>
  )
}
