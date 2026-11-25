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
        <Clock className={cn('size-3.5', loading && 'text-brand')} />
        <span className="hidden sm:inline">Dự báo trong</span>
      </span>
      <Tabs value={value} onValueChange={(v) => {
        const horizon = PREDICTION_HORIZONS.find((option) => option === v)
        if (horizon) onChange(horizon)
      }}>
        <TabsList aria-label="Mốc dự báo" className="h-9 bg-ink-950/70 p-1">
          {PREDICTION_HORIZONS.map((h) => (
            <TabsTrigger
              key={h}
              id={`horizon-${h}`}
              value={h}
              className="h-7 rounded-md px-3 text-xs font-semibold text-muted-foreground transition-all data-active:bg-gradient-to-r data-active:from-brand data-active:to-clear data-active:text-ink-950 data-active:shadow-[0_0_16px_rgb(34_211_238/0.4)]"
            >
              {HORIZON_LABEL[h]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
