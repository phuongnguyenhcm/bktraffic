import { useLanguage } from '@/i18n/use-language'
import type { TrafficStatus } from '@/types/traffic'
import { Badge } from '@/components/ui/badge'

export default function StatusBadge({ status }: { status: TrafficStatus }) {
  const { messages } = useLanguage()
  return (
    <Badge
      variant="outline"
      data-traffic-status={status}
      className="traffic-surface traffic-text gap-1.5 font-semibold"
    >
      <span className="traffic-dot size-1.5 rounded-full" aria-hidden />
      {messages.traffic[status]}
    </Badge>
  )
}
