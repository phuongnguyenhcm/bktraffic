import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  message: string
  onRetry?: () => void
  compact?: boolean
  className?: string
}

export default function ErrorState({ message, onRetry, compact, className }: Props) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-3 text-center', compact ? 'p-4' : 'p-8', className)}>
      <div data-traffic-status="CONGESTED" className="traffic-surface traffic-text grid size-12 place-items-center rounded-2xl border">
        <AlertTriangle className="size-6" />
      </div>
      <div>
        <p className="font-semibold text-foreground">Không tải được dữ liệu</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw /> Thử lại
        </Button>
      )}
    </div>
  )
}
