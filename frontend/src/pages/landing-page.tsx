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

const STATS = [
  { icon: Timer, value: '5 · 10 · 30 · 60', unit: 'phút', label: 'Khung dự báo' },
  { icon: Route, value: 'OSRM', unit: '', label: 'Tự trích xuất hình học đường' },
  { icon: Network, value: 'Node-Agent', unit: '', label: 'Mỗi điểm đo là một node' },
]

function HeroVisual() {
  const roads = [
    { d: 'M20 210 C 120 190, 200 200, 300 150 S 460 90, 520 70', c: '#10B981' },
    { d: 'M60 40 C 120 100, 180 140, 230 230 S 300 330, 340 340', c: '#F59E0B' },
    { d: 'M200 20 C 260 80, 300 120, 420 160 S 500 260, 540 300', c: '#EF4444' },
    { d: 'M10 300 C 120 280, 260 300, 360 250 S 480 220, 540 200', c: '#10B981' },
  ]
  const nodes: [number, number][] = [
    [300, 150],
    [230, 230],
    [420, 160],
    [360, 250],
  ]
  return (
    <figure className="glass relative overflow-hidden p-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.03)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.03)_1px,transparent_1px)] bg-[size:28px_28px]" />
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
            <circle cx={x} cy={y} r={14} fill="#22d3ee" fillOpacity={0.15} />
            <circle cx={x} cy={y} r={6} fill="#22d3ee" />
          </g>
        ))}
      </svg>
      <div className="relative mt-2 grid grid-cols-3 gap-2">
        {[
          { l: 'Lý Thường Kiệt', v: '78%', c: '#10B981' },
          { l: '3 Tháng 2', v: '52%', c: '#F59E0B' },
          { l: 'Tô Hiến Thành', v: '38%', c: '#EF4444' },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-white/5 bg-ink-950/60 px-3 py-2">
            <p className="truncate text-[11px] text-muted-foreground">{s.l}</p>
            <p className="text-xl font-bold" style={{ color: s.c }}>
              {s.v} <span className="text-xs font-medium text-slate-500">lưu thông</span>
            </p>
          </div>
        ))}
      </div>
    </figure>
  )
}

function FlowCard({ icon: Icon, title, sub, accent }: { icon: LucideIcon; title: string; sub: string; accent: string }) {
  return (
    <div className="glass relative flex-1 p-5 transition-transform hover:-translate-y-1">
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <div className="mb-3 grid size-11 place-items-center rounded-xl" style={{ background: `${accent}1f`, color: accent }}>
        <Icon className="size-5" />
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  )
}

function Connector({ bidirectional, label }: { bidirectional?: boolean; label: string }) {
  const Icon = bidirectional ? ArrowLeftRight : ArrowRight
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1 py-2 text-brand lg:px-1">
      <Icon className="size-6 rotate-90 lg:rotate-0" />
      <span className="text-center text-[10px] font-medium tracking-wide text-slate-500 uppercase">{label}</span>
    </div>
  )
}

const ROLES = [
  {
    id: 'role-end-user',
    icon: Users,
    accent: '#22d3ee',
    title: 'End User',
    desc: 'Xem bản đồ giao thông, cảnh báo kẹt xe và vận tốc dự báo trên từng tuyến đường cho 5 phút đến 1 giờ tới.',
    points: ['Bản đồ màu theo mức độ ùn tắc', 'Chọn nhanh khung dự báo 5p / 10p / 30p / 1h', 'Biểu đồ lịch sử & dự báo LSTM-FedProx'],
    to: '/dashboard',
    cta: 'Mở Dashboard',
  },
  {
    id: 'role-edge-user',
    icon: Cpu,
    accent: '#10b981',
    title: 'Edge User',
    desc: 'Biến mini PC / Raspberry Pi thành một Agent huấn luyện. Khai báo node, nối các node và xuất file target.json.',
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
          <Badge variant="outline" className="gap-2 border-brand/30 bg-brand/10 px-3 py-1 text-brand">
            <BrainCircuit className="size-3.5" /> Federated Learning · LSTM-FedProx
          </Badge>
          <h1 className="mt-5 text-4xl leading-[1.1] font-extrabold tracking-tight text-white sm:text-5xl xl:text-6xl">
            Dự báo vận tốc giao thông{' '}
            <span className="bg-gradient-to-r from-brand via-clear to-brand-2 bg-clip-text text-transparent">thời gian thực</span> tại
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
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-brand/50 hover:bg-white/10"
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
            <Icon className="size-5 text-brand" />
            <p className="mt-3 text-2xl font-bold text-white">
              {value} <span className="text-sm font-medium text-slate-500">{unit}</span>
            </p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-8 text-center">
          <p className="eyebrow">Hai vai trò người dùng</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Bạn tham gia hệ thống như thế nào?</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {ROLES.map((r) => (
            <Card key={r.id} id={r.id} className="glass group relative overflow-hidden py-7 ring-0">
              <div
                className="pointer-events-none absolute -top-24 -right-24 size-56 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-40"
                style={{ background: r.accent }}
              />
              <CardContent className="px-7">
                <div className="mb-4 grid size-12 place-items-center rounded-2xl" style={{ background: `${r.accent}1f`, color: r.accent }}>
                  <r.icon className="size-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">{r.title}</h3>
                <p className="mt-2 text-muted-foreground">{r.desc}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  {r.points.map((p) => (
                    <li key={p} className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full" style={{ background: r.accent }} /> {p}
                    </li>
                  ))}
                </ul>
                <Link
                  to={r.to}
                  id={`${r.id}-cta`}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold transition-colors hover:border-brand/50 hover:bg-white/10"
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
          <h2 className="mt-2 text-3xl font-bold text-white">Luồng hoạt động</h2>
        </div>
        <div className="flex flex-col items-stretch lg:flex-row">
          <FlowCard icon={MapPinned} accent="#10b981" title="Edge Agents (Local LSTM)" sub="Đọc target.json, thu thập speed_ratio tại từng node, huấn luyện LSTM cục bộ và gửi trọng số." />
          <Connector bidirectional label="Trọng số ⇄ Global model" />
          <FlowCard icon={Server} accent="#818cf8" title="FL Server (FedProx)" sub="Tổng hợp tham số với số hạng proximal μ, xử lý non-IID giữa khu vực. Backend gắn polyline (OSRM) ở bước cuối." />
          <Connector label="REST /traffic/map" />
          <FlowCard icon={LayoutDashboard} accent="#22d3ee" title="End User Dashboard" sub="Nhận { nodes, edges } sẵn sàng hiển thị: màu ùn tắc, vận tốc dự báo, độ tin cậy." />
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Gauge className="size-3.5 shrink-0" /> Mức lưu thông = vận tốc dự báo / tốc độ giới hạn · ≥ 75% thông thoáng · từ 45% đến dưới 75% đông đúc · &lt; 45% ùn tắc
        </div>
      </section>
    </div>
  )
}
