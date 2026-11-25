import { Cpu, MapPin, RefreshCw, Server } from 'lucide-react'
import { fetchEdgeNodes } from '@/services/api'
import { useAsync } from '@/hooks/use-async'
import type { EdgeAgent, EdgeAgentStatus } from '@/types/traffic'
import { timeAgo } from '@/lib/traffic'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import ErrorState from '@/components/common/error-state'
import ConfigBuilder from '@/components/edge/config-builder'

const STATUS_STYLE: Record<EdgeAgentStatus, { color: string; label: string }> = {
  ONLINE: { color: '#10B981', label: 'Online' },
  TRAINING: { color: '#818cf8', label: 'Training' },
  IDLE: { color: '#64748b', label: 'Idle' },
}

function AgentCard({ agent }: { agent: EdgeAgent }) {
  const s = STATUS_STYLE[agent.status]
  const progress = Math.round((agent.currentRound / agent.totalRounds) * 100)
  return (
    <Card id={`agent-${agent.id}`} className="glass gap-3 py-5 ring-0 transition-transform hover:-translate-y-0.5">
      <CardContent className="space-y-3 px-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl" style={{ background: `${s.color}1f`, color: s.color }}>
              <Cpu className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">{agent.name}</h3>
              <p className="font-mono text-[11px] text-slate-500">{agent.id}</p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1.5" style={{ color: s.color, borderColor: `${s.color}55`, background: `${s.color}14` }}>
            <span className={`size-1.5 rounded-full ${agent.status === 'TRAINING' ? 'animate-ping' : ''}`} style={{ background: s.color }} />
            {s.label}
          </Badge>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-slate-300">
          <MapPin className="size-3.5 text-slate-500" /> {agent.region}
        </p>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            { l: 'Nodes', v: agent.managedNodeCount },
            { l: 'Round', v: `#${agent.currentRound}` },
            { l: 'Local loss', v: agent.localLoss.toFixed(3) },
          ].map((x) => (
            <div key={x.l} className="rounded-lg bg-ink-950/60 py-2">
              <dt className="text-[10px] text-slate-500 uppercase">{x.l}</dt>
              <dd className="font-bold text-white">{x.v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-slate-500">
            <span>
              FedProx {agent.currentRound}/{agent.totalRounds}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${s.color}, #22d3ee)` }} />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          {agent.device} · heartbeat {timeAgo(agent.lastHeartbeat)}
        </p>
      </CardContent>
    </Card>
  )
}

export default function EdgeNodesPage() {
  const agents = useAsync(fetchEdgeNodes, 'agents', 10_000)
  const active = (agents.data ?? []).filter((a) => a.status !== 'IDLE').length

  return (
    <div className="space-y-10 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Edge User Portal</p>
          <h1 className="mt-1 text-3xl font-bold text-white sm:text-4xl">Cổng Edge Node & Cấu hình Agent</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Theo dõi các Agent trong mạng Federated Learning và tạo file <code className="font-mono text-brand">target.json</code> để biến thiết bị
            của bạn thành một node huấn luyện LSTM.
          </p>
        </div>
        <div className="glass flex items-center gap-4 px-5 py-3">
          <Server className="size-6 text-brand-2" />
          <div>
            <p className="text-xl font-bold text-white">{agents.data ? `${active}/${agents.data.length}` : '–'}</p>
            <p className="text-xs text-muted-foreground">Agent đang hoạt động</p>
          </div>
        </div>
      </header>

      <section aria-labelledby="agents-title">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="agents-title" className="text-xl font-semibold text-white">
            Mạng lưới Edge Agent
          </h2>
          <Button id="agents-refresh" variant="outline" size="sm" onClick={agents.reload}>
            <RefreshCw className={agents.loading ? 'animate-spin' : ''} /> Làm mới
          </Button>
        </div>
        {agents.data && agents.error && (
          <p role="status" className="mb-3 text-sm text-moderate">Làm mới thất bại. Đang hiển thị danh sách đã tải.</p>
        )}
        {agents.error && !agents.data ? (
          <div className="glass">
            <ErrorState message={agents.error} onRetry={agents.reload} />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {agents.data
              ? agents.data.map((a) => <AgentCard key={a.id} agent={a} />)
              : Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
          </div>
        )}
      </section>

      <ConfigBuilder />
    </div>
  )
}
