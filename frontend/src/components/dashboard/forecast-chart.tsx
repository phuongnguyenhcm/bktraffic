import { useLanguage } from '@/i18n/use-language'
import { useId } from 'react'
import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { NodeHistoryResponse, PredictionHorizon } from '@/types/traffic'
import { STATUS_META, formatSpeed, formatClock } from '@/lib/traffic'

interface ChartPoint {
  t: number
  history?: number
  forecast?: number
  horizon?: PredictionHorizon
}

interface Props {
  data: NodeHistoryResponse
  selectedHorizon: PredictionHorizon
}

/** Lịch sử (nét liền) + dự báo 5p → 10p → 30p → 60p (nét đứt), trục thời gian thực */
export default function ForecastChart({ data, selectedHorizon }: Props) {
  const { messages, locale } = useLanguage()
  const historyFill = useId()
  const { history, node } = data
  const forecasts = data.forecasts.filter((forecast) => forecast.status !== 'UNKNOWN')
  const limit = node.speedLimitKmh

  const points: ChartPoint[] = history.map((h) => ({ t: Date.parse(h.timestamp), history: h.speedKmh }))
  const last = points[points.length - 1]
  if (last && forecasts.length) last.forecast = last.history
  forecasts.forEach((f) => points.push({ t: Date.parse(f.timestamp), forecast: f.predictedSpeedKmh, horizon: f.horizonMinutes }))

  const selected = forecasts.find((f) => f.horizonMinutes === selectedHorizon)
  const yMax = Math.ceil((limit * 1.1) / 5) * 5

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={points} margin={{ top: 16, right: 14, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id={historyFill} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* Dải màu nền theo ngưỡng trạng thái */}
        <ReferenceArea y1={0} y2={limit * 0.45} fill={STATUS_META.CONGESTED.color} fillOpacity={0.06} />
        <ReferenceArea y1={limit * 0.45} y2={limit * 0.75} fill={STATUS_META.MODERATE.color} fillOpacity={0.06} />
        <ReferenceArea y1={limit * 0.75} y2={yMax} fill={STATUS_META.CLEAR.color} fillOpacity={0.06} />
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(v: number) => formatClock(v, locale)}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          minTickGap={28}
        />
        <YAxis domain={[0, yMax]} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickLine={false} axisLine={false} unit="" />
        <Tooltip
          contentStyle={{ background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}
          labelStyle={{ color: 'var(--muted-foreground)' }}
          itemStyle={{ color: 'var(--foreground)' }}
          labelFormatter={(v) => formatClock(Number(v), locale)}
          formatter={(v) => `${formatSpeed(Number(v), locale)} km/h`}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} iconType="plainline" />
        <ReferenceLine
          y={limit}
          stroke={STATUS_META.CLEAR.color}
          strokeDasharray="2 4"
          label={{ value: messages.traffic.limit(limit), fill: 'var(--traffic-clear-foreground)', fontSize: 10, position: 'insideTopRight' }}
        />
        {last && <ReferenceLine x={last.t} stroke="var(--input)" label={{ value: messages.traffic.current, fill: 'var(--muted-foreground)', fontSize: 10, position: 'top' }} />}
        <Area name={messages.traffic.history} type="monotone" dataKey="history" stroke="var(--chart-1)" strokeWidth={2.5} fill={`url(#${historyFill})`} dot={false} connectNulls={false} isAnimationActive={false} />
        <Line
          name={messages.traffic.forecast}
          type="monotone"
          dataKey="forecast"
          stroke="var(--chart-2)"
          strokeWidth={2.5}
          strokeDasharray="6 5"
          dot={{ r: 3, fill: 'var(--chart-2)', strokeWidth: 0 }}
          connectNulls
          isAnimationActive={false}
        />
        {selected && (
          <ReferenceDot
            x={Date.parse(selected.timestamp)}
            y={selected.predictedSpeedKmh}
            r={7}
            fill={STATUS_META[selected.status].color}
            stroke="var(--card)"
            strokeWidth={2}
            label={{ value: `+${messages.traffic.minutes(selected.horizonMinutes)}`, fill: 'var(--foreground)', fontSize: 10, position: 'top' }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
