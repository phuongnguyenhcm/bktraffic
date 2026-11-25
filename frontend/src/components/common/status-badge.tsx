import type { TrafficStatus } from '@/types/traffic'
import { STATUS_META } from '@/lib/traffic'
import { Badge } from '@/components/ui/badge'

export default function StatusBadge({ status }: { status: TrafficStatus }) {
  const m = STATUS_META[status]
  return (
    <Badge
      variant="outline"
      className="gap-1.5 font-semibold"
      style={{ color: m.color, borderColor: `${m.color}55`, background: `${m.color}1a` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: m.color, boxShadow: `0 0 8px ${m.color}` }} />
      {m.shortLabel}
    </Badge>
  )
}
