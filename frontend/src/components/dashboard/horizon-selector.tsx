import { Clock } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HORIZON_LABEL } from '@/lib/traffic'
import { PREDICTION_HORIZONS, type PredictionHorizon } from '@/types/traffic'
import { cn } from '@/lib/utils'

interface Props {
  value: PredictionHorizon
  onChange: (h: PredictionHorizon) => void
  loading?: boolean
  className?: string
}

/** Bộ chọn khung dự báo nổi bật (Agents.md §7) */
export default function HorizonSelector({ value, onChange, loading, className }: Props) {
  return (
    <div className={cn('glass flex items-center gap-3 p-1.5 pl-3', className)}>
      <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Clock className={cn('size-3.5', loading && 'text-primary')} />
        <span className="hidden sm:inline">Dự báo trong</span>
      </span>
      <Tabs value={value} onValueChange={(v) => {
        const horizon = PREDICTION_HORIZONS.find((option) => option === v)
        if (horizon) onChange(horizon)
      }}>
        <TabsList aria-label="Mốc dự báo" className="h-9 bg-background p-1">
          {PREDICTION_HORIZONS.map((h) => (
            <TabsTrigger
              key={h}
              id={`horizon-${h}`}
              value={h}
              className="h-7 rounded-md px-3 text-xs font-semibold text-muted-foreground transition-colors data-active:border-primary data-active:bg-primary data-active:text-primary-foreground dark:data-active:border-primary dark:data-active:bg-primary dark:data-active:text-primary-foreground"
            >
              {HORIZON_LABEL[h]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
