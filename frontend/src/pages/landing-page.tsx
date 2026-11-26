import { Link } from 'react-router-dom'
import {
  ArrowLeftRight,
  ArrowRight,
  BrainCircuit,
  Cpu,
  Gauge,
  LayoutDashboard,
  MapPinned,
  Network,
  Route,
  Server,
  Timer,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { STATUS_META } from '@/lib/traffic'

const STATS = [
  { icon: Timer, value: '5 · 10 · 30 · 60', unit: 'phút', label: 'Khung dự báo' },
  { icon: Route, value: 'OSRM', unit: '', label: 'Tự trích xuất hình học đường' },
  { icon: Network, value: 'Node-Agent', unit: '', label: 'Mỗi điểm đo là một node' },
]

function HeroVisual() {
  const roads = [
    { d: 'M20 210 C 120 190, 200 200, 300 150 S 460 90, 520 70', c: STATUS_META.CLEAR.color },
    { d: 'M60 40 C 120 100, 180 140, 230 230 S 300 330, 340 340', c: STATUS_META.MODERATE.color },
    { d: 'M200 20 C 260 80, 300 120, 420 160 S 500 260, 540 300', c: STATUS_META.CONGESTED.color },
    { d: 'M10 300 C 120 280, 260 300, 360 250 S 480 220, 540 200', c: STATUS_META.CLEAR.color },
  ]
  const nodes: [number, number][] = [
    [300, 150],
    [230, 230],
    [420, 160],
    [360, 250],
  ]
  return (
    <figure className="glass relative overflow-hidden p-4">
      <div className="preview-grid absolute inset-0" />
      <figcaption className="relative text-xs font-medium text-muted-foreground">Minh họa bản đồ dự báo</figcaption>
      <svg viewBox="0 0 550 360" className="relative w-full" aria-hidden>
        {roads.map((r, i) => (
          <g key={i}>
            <path d={r.d} stroke={r.c} strokeOpacity={0.18} strokeWidth={14} fill="none" strokeLinecap="round" />
            <path d={r.d} stroke={r.c} strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray="10 10" className="motion-safe:animate-dash" />
          </g>
        ))}
        {nodes.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={14} fill="var(--primary)" fillOpacity={0.15} />
            <circle cx={x} cy={y} r={6} fill="var(--primary)" />
          </g>
        ))}
      </svg>
      <div className="relative mt-2 grid grid-cols-3 gap-2">
        {[
          { l: 'Lý Thường Kiệt', v: '78%', status: 'CLEAR' },
          { l: '3 Tháng 2', v: '52%', status: 'MODERATE' },
          { l: 'Tô Hiến Thành', v: '38%', status: 'CONGESTED' },
        ].map((s) => (
          <div key={s.l} data-traffic-status={s.status} className="rounded-xl border border-border bg-card px-3 py-2">
            <p className="truncate text-[11px] text-muted-foreground">{s.l}</p>
            <p className="traffic-text text-xl font-bold">
              {s.v} <span className="text-xs font-medium text-muted-foreground">lưu thông</span>
            </p>
          </div>
        ))}
      </div>
    </figure>
  )
}

function FlowCard({ icon: Icon, title, sub, iconClass }: { icon: LucideIcon; title: string; sub: string; iconClass: string }) {
  return (
    <div className="glass relative flex-1 p-5 transition-transform hover:-translate-y-1">
      <div className={`mb-3 grid size-11 place-items-center rounded-xl ${iconClass}`}>
        <Icon className="size-5" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  )
}

function Connector({ bidirectional, label }: { bidirectional?: boolean; label: string }) {
  const Icon = bidirectional ? ArrowLeftRight : ArrowRight
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1 py-2 text-primary lg:px-1">
      <Icon className="size-6 rotate-90 lg:rotate-0" />
      <span className="text-center text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
    </div>
  )
}

const ROLES = [
  {
    id: 'role-end-user',
    icon: Users,
    iconClass: 'bg-accent text-accent-foreground',
    title: 'End User',
    desc: 'Xem bản đồ giao thông, cảnh báo kẹt xe và vận tốc dự báo trên từng tuyến đường cho 5 phút đến 1 giờ tới.',
    points: ['Bản đồ màu theo mức độ ùn tắc', 'Chọn nhanh khung dự báo 5p / 10p / 30p / 1h', 'Biểu đồ lịch sử & dự báo LSTM-FedProx'],
    to: '/dashboard',
    cta: 'Mở Dashboard',
  },
  {
    id: 'role-edge-user',
    icon: Cpu,
    iconClass: 'bg-clear/10 text-clear',
    title: 'Edge User',
    desc: 'Cấu hình Edge Agent cho mini PC hoặc Raspberry Pi. Khai báo điểm đo, nối các cung đường và tải cấu hình Edge Client.',
    points: ['Chế độ Auto: chỉ cần lat/lon, hệ thống tự vẽ đường', 'Chế độ Manual: dán polyline tuỳ chỉnh', 'Theo dõi vòng FedProx của mạng lưới'],
    to: '/edge-nodes',
    cta: 'Cấu hình Edge Node',
  },
]

export default function LandingPage() {
  return (
    <div className="space-y-24 py-12 sm:py-16">
      <section className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Badge variant="outline" className="gap-2 border-primary/30 bg-primary/10 px-3 py-1 text-primary">
            <BrainCircuit className="size-3.5" /> Federated Learning · LSTM-FedProx
          </Badge>
          <h1 className="mt-5 text-4xl leading-[1.1] font-extrabold tracking-tight text-foreground sm:text-5xl xl:text-6xl">
            Dự báo vận tốc giao thông{' '}
            <span className="bg-gradient-to-r from-primary via-clear to-chart-2 bg-clip-text text-transparent">thời gian thực</span> tại
            node biên
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Trong kiến trúc Node-Agent, mỗi Edge Agent huấn luyện LSTM từ các điểm đo mình quản lý. Máy chủ dùng FedProx
            để tổng hợp tham số mô hình. Bản demo dự báo dựa trên dữ liệu cảm biến mô phỏng.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link id="hero-cta-dashboard" to="/dashboard" className="glow-btn inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm">
              Xem bản đồ dự báo <ArrowRight className="size-4" />
            </Link>
            <Link
              id="hero-cta-edge"
              to="/edge-nodes"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-accent"
            >
              <Cpu className="size-4" /> Trở thành Edge Node
            </Link>
          </div>
        </div>
        <HeroVisual />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {STATS.map(({ icon: Icon, value, unit, label }) => (
          <div key={label} className="glass p-5">
            <Icon className="size-5 text-primary" />
            <p className="mt-3 text-2xl font-bold text-foreground">
              {value} <span className="text-sm font-medium text-muted-foreground">{unit}</span>
            </p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-8 text-center">
          <p className="eyebrow">Hai vai trò người dùng</p>
          <h2 className="mt-2 text-3xl font-bold text-foreground">Bạn tham gia hệ thống như thế nào?</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {ROLES.map((r) => (
            <Card key={r.id} id={r.id} className="glass group relative overflow-hidden py-7 ring-0">
              <CardContent className="px-7">
                <div className={`mb-4 grid size-12 place-items-center rounded-2xl ${r.iconClass}`}>
                  <r.icon className="size-6" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">{r.title}</h3>
                <p className="mt-2 text-muted-foreground">{r.desc}</p>
                <ul className="mt-4 space-y-2 text-sm text-foreground">
                  {r.points.map((p) => (
                    <li key={p} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" aria-hidden /> {p}
                    </li>
                  ))}
                </ul>
                <Link
                  to={r.to}
                  id={`${r.id}-cta`}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-semibold transition-colors hover:border-primary/50 hover:bg-accent"
                >
                  {r.cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-8 text-center">
          <p className="eyebrow">Kiến trúc Node-Agent</p>
          <h2 className="mt-2 text-3xl font-bold text-foreground">Luồng hoạt động</h2>
        </div>
        <div className="flex flex-col items-stretch lg:flex-row">
          <FlowCard icon={MapPinned} iconClass="bg-clear/10 text-clear" title="Edge Agents (Local LSTM)" sub="Thu thập dữ liệu tại các điểm đo đã cấu hình, huấn luyện LSTM cục bộ và gửi trọng số." />
          <Connector bidirectional label="Trọng số ⇄ Global model" />
          <FlowCard icon={Server} iconClass="bg-chart-2/10 text-chart-2" title="FL Server (FedProx)" sub="Tổng hợp tham số với số hạng proximal μ, xử lý non-IID giữa khu vực. Backend gắn polyline (OSRM) ở bước cuối." />
          <Connector label="REST /traffic/map" />
          <FlowCard icon={LayoutDashboard} iconClass="bg-accent text-accent-foreground" title="End User Dashboard" sub="Nhận { nodes, edges } sẵn sàng hiển thị: màu ùn tắc, vận tốc dự báo, độ tin cậy." />
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Gauge className="size-3.5 shrink-0" /> Mức lưu thông = vận tốc dự báo / tốc độ giới hạn · ≥ 75% thông thoáng · từ 45% đến dưới 75% đông đúc · &lt; 45% ùn tắc
        </div>
      </section>
    </div>
  )
}
