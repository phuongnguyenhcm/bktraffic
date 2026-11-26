import type { TrafficStatus } from '@/types/traffic'
import { STATUS_META } from '@/lib/traffic'
import { Badge } from '@/components/ui/badge'

export default function StatusBadge({ status }: { status: TrafficStatus }) {
  const m = STATUS_META[status]
  return (
    <Badge
      variant="outline"
      data-traffic-status={status}
      className="traffic-surface traffic-text gap-1.5 font-semibold"
    >
      <span className="traffic-dot size-1.5 rounded-full" aria-hidden />
      {m.shortLabel}
    </Badge>
  )
}
