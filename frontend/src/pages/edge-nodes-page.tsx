import { Link } from 'react-router-dom'
import { Clock, Cpu, MapPin, MapPinned, Plus, RefreshCw, Server, Wifi, type LucideIcon } from 'lucide-react'
import { fetchEdgeNodes } from '@/services/api'
import { useAsync } from '@/hooks/use-async'
import type { EdgeAgent } from '@/types/traffic'
import { formatDateTime, timeAgo } from '@/lib/traffic'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import ErrorState from '@/components/common/error-state'

function StatCard({ icon: Icon, label, value, iconClass }: { icon: LucideIcon; label: string; value: string; iconClass: string }) {
  return (
    <div className="glass flex items-center gap-4 p-5">
      <div className={`grid size-11 place-items-center rounded-xl ${iconClass}`}>
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function AgentCard({ agent }: { agent: EdgeAgent }) {
  const tone = agent.status === 'ONLINE' ? 'CLEAR' : 'UNKNOWN'
  return (
    <Card id={`agent-${agent.id}`} className="glass gap-3 py-5 ring-0 transition-transform hover:-translate-y-0.5">
      <CardContent className="space-y-4 px-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div data-traffic-status={tone} className="traffic-surface traffic-text grid size-10 shrink-0 place-items-center rounded-xl">
              <Cpu className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-foreground">{agent.name}</h3>
              <p className="truncate text-[11px] text-muted-foreground">{agent.agentId}</p>
            </div>
          </div>
          <Badge variant="outline" data-traffic-status={tone} className="traffic-surface traffic-text gap-1.5 font-semibold">
            <span className="traffic-dot size-1.5 rounded-full" aria-hidden />
            {agent.status}
          </Badge>
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-3.5" /> Khu vực
            </dt>
            <dd className="truncate text-right text-foreground">{agent.region}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <MapPinned className="size-3.5" /> Điểm đo quản lý
            </dt>
            <dd className="font-semibold text-foreground">{agent.managedNodeCount}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-3.5" /> Cập nhật cuối
            </dt>
            <dd className="text-right text-foreground">
              <time dateTime={agent.lastSeenAt} title={formatDateTime(agent.lastSeenAt)}>{timeAgo(agent.lastSeenAt)}</time>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

export default function EdgeNodesPage() {
  const agents = useAsync(fetchEdgeNodes, 'agents', 10_000)
  const list = agents.data ?? []
  const online = list.filter((agent) => agent.status === 'ONLINE').length
  const totalPoints = list.reduce((s, a) => s + a.managedNodeCount, 0)

  return (
    <div className="space-y-8 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Mạng lưới Edge Agents</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Theo dõi kết nối và các điểm đo do từng Edge Agent quản lý.</p>
        </div>
        <Link to="/edge-nodes/setup" id="cta-deploy-edge" className="glow-btn inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm">
          <Plus className="size-4" /> Triển khai Edge Node mới
        </Link>
      </header>

      {(!agents.error || agents.data) && (
        <section className="grid gap-4 sm:grid-cols-3" aria-label="Thống kê tổng quan">
          {agents.data ? (
            <>
              <StatCard icon={Server} label="Tổng số Agent" value={String(list.length)} iconClass="bg-chart-2/10 text-chart-2" />
              <StatCard icon={Wifi} label="Agent online" value={String(online)} iconClass="bg-clear/10 text-clear" />
              <StatCard icon={MapPinned} label="Điểm đo đã đăng ký" value={String(totalPoints)} iconClass="bg-accent text-accent-foreground" />
            </>
          ) : (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[86px] rounded-2xl" />)
          )}
        </section>
      )}

      <section aria-labelledby="agents-title">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="agents-title" className="text-xl font-semibold text-foreground">
            Danh sách Agent
          </h2>
          <Button id="agents-refresh" variant="outline" size="sm" onClick={agents.reload}>
            <RefreshCw className={agents.loading ? 'animate-spin' : ''} /> Làm mới
          </Button>
        </div>
        {agents.error && agents.data && (
          <p role="status" className="mb-3 text-sm text-moderate">Làm mới thất bại. Đang hiển thị danh sách đã tải.</p>
        )}
        {agents.error && !agents.data ? (
          <div className="glass">
            <ErrorState message={agents.error} onRetry={agents.reload} />
          </div>
        ) : agents.data && list.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 p-10 text-center">
            <Server className="size-8 text-muted-foreground" />
            <p className="text-muted-foreground">Chưa có Edge Agent nào tham gia mạng lưới.</p>
            <Link to="/edge-nodes/setup" className="text-sm font-semibold text-primary hover:underline">
              Triển khai Edge Node đầu tiên →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {agents.data ? list.map((a) => <AgentCard key={a.id} agent={a} />) : Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-60 rounded-2xl" />)}
          </div>
        )}
      </section>
    </div>
  )
}
