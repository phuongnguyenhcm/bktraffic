import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { NodeHistoryResponse, PredictionHorizon } from '@/types/traffic'
import { STATUS_META, formatClock } from '@/lib/traffic'

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
  const { history, forecasts, node } = data
  const limit = node.speedLimitKmh

  const points: ChartPoint[] = history.map((h) => ({ t: Date.parse(h.timestamp), history: h.speedKmh }))
  const last = points[points.length - 1]
  if (last) last.forecast = last.history
  forecasts.forEach((f) => points.push({ t: Date.parse(f.timestamp), forecast: f.predictedSpeedKmh, horizon: f.horizonMinutes }))

  const selected = forecasts.find((f) => f.horizonMinutes === selectedHorizon)
  const yMax = Math.ceil((limit * 1.1) / 5) * 5

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={points} margin={{ top: 16, right: 14, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="histFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* Dải màu nền theo ngưỡng trạng thái */}
        <ReferenceArea y1={0} y2={limit * 0.45} fill="#EF4444" fillOpacity={0.05} />
        <ReferenceArea y1={limit * 0.45} y2={limit * 0.75} fill="#F59E0B" fillOpacity={0.05} />
        <ReferenceArea y1={limit * 0.75} y2={yMax} fill="#10B981" fillOpacity={0.05} />
        <CartesianGrid stroke="rgb(255 255 255 / 0.06)" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(v: number) => formatClock(new Date(v).toISOString())}
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          minTickGap={28}
        />
        <YAxis domain={[0, yMax]} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} unit="" />
        <Tooltip
          contentStyle={{ background: '#0b1220', border: '1px solid rgb(255 255 255 / 0.1)', borderRadius: 12, fontSize: 12 }}
          labelStyle={{ color: '#94a3b8' }}
          labelFormatter={(v) => formatClock(new Date(Number(v)).toISOString())}
          formatter={(v) => `${String(v)} km/h`}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} iconType="plainline" />
        <ReferenceLine
          y={limit}
          stroke="#10B981"
          strokeDasharray="2 4"
          label={{ value: `Giới hạn ${limit}`, fill: '#10B981', fontSize: 10, position: 'insideTopRight' }}
        />
        {last && <ReferenceLine x={last.t} stroke="rgb(255 255 255 / 0.25)" label={{ value: 'Hiện tại', fill: '#94a3b8', fontSize: 10, position: 'top' }} />}
        <Area name="Lịch sử (cảm biến)" type="monotone" dataKey="history" stroke="#22d3ee" strokeWidth={2.5} fill="url(#histFill)" dot={false} connectNulls={false} isAnimationActive={false} />
        <Line
          name="Dự báo"
          type="monotone"
          dataKey="forecast"
          stroke="#a78bfa"
          strokeWidth={2.5}
          strokeDasharray="6 5"
          dot={{ r: 3, fill: '#a78bfa', strokeWidth: 0 }}
          connectNulls
          isAnimationActive={false}
        />
        {selected && (
          <ReferenceDot
            x={Date.parse(selected.timestamp)}
            y={selected.predictedSpeedKmh}
            r={7}
            fill={STATUS_META[selected.status].color}
            stroke="#0b1220"
            strokeWidth={2}
            label={{ value: `+${selected.horizonMinutes}p`, fill: '#e2e8f0', fontSize: 10, position: 'top' }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
