import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  Loader2,
  PackageCheck,
  Terminal,
} from 'lucide-react'
import { ApiError, generateEdgeConfig, toErrorMessage } from '@/services/api'
import type { GenerateConfigResponse } from '@/types/traffic'
import { buildAreaRequest, type MonitoringArea } from '@/lib/edge-setup'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import MonitoringAreaEditor from '@/components/edge/monitoring-area-editor'
import { cn } from '@/lib/utils'

const CONFIG_FILE_NAME = 'edge-agent-config.json'
const DOCKER_LABEL = 'Docker Container'
const STEPS = [
  { n: 1, title: 'Thông tin thiết bị' },
  { n: 2, title: 'Khu vực giám sát' },
  { n: 3, title: 'Tải gói cài đặt' },
] as const

type Step = 1 | 2 | 3

interface EdgeAgentPackage {
  version: string
  agent: { name: string; region: string; platform: 'docker' }
  generatedAt: string
  nodes: GenerateConfigResponse['config']['nodes']
  connections: GenerateConfigResponse['config']['connections']
}

const slug = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'edge-agent'

function Stepper({ step }: { step: Step }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-4">
      {STEPS.map((s, i) => {
        const done = step > s.n
        const active = step === s.n
        return (
          <li key={s.n} aria-current={active ? 'step' : undefined} className="flex flex-1 items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2.5">
              <span
                data-traffic-status={done ? 'CLEAR' : undefined}
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-full border text-sm font-bold transition-colors',
                  done && 'traffic-surface traffic-text',
                  active && 'border-primary bg-primary/15 text-primary shadow-panel',
                  !done && !active && 'border-border text-muted-foreground',
                )}
              >
                {done ? <Check className="size-4" /> : s.n}
              </span>
              <span className={cn('sr-only text-sm font-medium sm:not-sr-only', active ? 'text-foreground' : 'text-muted-foreground')}>{s.title}</span>
            </div>
            {i < STEPS.length - 1 && <span className={cn('h-px flex-1', done ? 'bg-clear/60' : 'bg-accent')} />}
          </li>
        )
      })}
    </ol>
  )
}

function CopyLine({ id, command }: { id: string; command: string }) {
  const [feedback, setFeedback] = useState<'copied' | 'unavailable' | null>(null)
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(command)
      setFeedback('copied')
    } catch {
      setFeedback('unavailable')
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted p-3">
        <Terminal className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <code id={id} className="min-w-0 flex-1 font-mono text-[11.5px] leading-relaxed break-all text-foreground">
          {command}
        </code>
        <Button variant="ghost" size="icon-sm" onClick={() => void copy()} aria-label="Sao chép lệnh">
          {feedback === 'copied' ? <Check className="text-clear" /> : <Copy />}
        </Button>
      </div>
      {feedback && (
        <p role="status" className="text-xs text-muted-foreground">
          {feedback === 'copied' ? 'Đã sao chép lệnh.' : 'Hãy chọn văn bản và sao chép lệnh thủ công.'}
        </p>
      )}
    </div>
  )
}

export default function EdgeSetupPage() {
  const [step, setStep] = useState<Step>(1)

  // Bước 1
  const [agentName, setAgentName] = useState('')
  const [region, setRegion] = useState('')

  // Bước 2
  const [monitoringArea, setMonitoringArea] = useState<MonitoringArea>({ points: [], links: [] })

  // Bước 3
  const [pkg, setPkg] = useState<EdgeAgentPackage | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const hasAgentName = Boolean(agentName.trim())
  const area = useMemo(() => buildAreaRequest(monitoringArea), [monitoringArea])

  const goToPackage = async (): Promise<void> => {
    if (!area.request) return
    setGenerating(true)
    setGenError(null)
    setDownloaded(false)
    try {
      const res = await generateEdgeConfig({ agentName: agentName.trim(), ...area.request })
      setPkg({
        version: '1.0',
        agent: { name: agentName.trim(), region: region.trim(), platform: 'docker' },
        generatedAt: new Date().toISOString(),
        nodes: Object.fromEntries(monitoringArea.points.map(({ id, name }) => [id, { ...res.config.nodes[id], name }])),
        connections: res.config.connections,
      })
      setStep(3)
    } catch (e) {
      setGenError(e instanceof ApiError && e.status === 413
        ? 'Cấu hình quá lớn để gửi. Hãy giảm số cung đường hoặc dùng tệp ít tọa độ hơn.'
        : toErrorMessage(e))
    } finally {
      setGenerating(false)
    }
  }

  const json = pkg ? JSON.stringify(pkg, null, 2) : ''
  const download = (): void => {
    if (!pkg) return
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: CONFIG_FILE_NAME })
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setDownloaded(true)
  }

  const agentSlug = slug(agentName).slice(0, 63)
  const dockerCommand = `docker run -d --name ${agentSlug} --restart unless-stopped --mount "type=bind,source=$PWD/${CONFIG_FILE_NAME},target=/app/${CONFIG_FILE_NAME},readonly" "${'$'}{EDGE_CLIENT_IMAGE:?Chưa đặt EDGE_CLIENT_IMAGE}" --config /app/${CONFIG_FILE_NAME}`

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-10">
      <header className="space-y-4">
        <Link to="/edge-nodes" id="setup-back" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Mạng lưới Edge Agents
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Triển khai Edge Node mới</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Đặt tên Agent, khai báo điểm đo và chuẩn bị cấu hình Edge Client chạy bằng Docker.
          </p>
        </div>
        <Stepper step={step} />
      </header>

      <Card className="glass gap-0 py-0 ring-0">
        <CardContent className="p-6">
          {/* ───────── Bước 1 ───────── */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Thông tin thiết bị</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="eyebrow">Tên Agent</span>
                  <Input id="agent-name" required maxLength={80} value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="vd: Agent Lý Thường Kiệt" className="bg-background" />
                </label>
                <label className="block space-y-1.5">
                  <span className="eyebrow">Khu vực quản lý (không bắt buộc)</span>
                  <Input id="agent-region" maxLength={120} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="vd: Quận 10 – TP.HCM" className="bg-background" />
                </label>
              </div>
              <div>
                <p className="eyebrow">Nền tảng thiết bị biên</p>
                <div className="mt-2 flex max-w-sm items-start gap-3 rounded-xl border border-primary/60 bg-primary/10 p-4 shadow-panel">
                  <Box className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{DOCKER_LABEL}</p>
                    <p className="text-xs text-muted-foreground">Mọi máy có Docker Engine</p>
                  </div>
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span className="sr-only">Đã chọn</span>
                </div>
              </div>
            </div>
          )}

          {/* ───────── Bước 2 ───────── */}
          {step === 2 && (
            <fieldset disabled={generating} className="min-w-0">
              <legend className="mb-4 text-lg font-semibold text-foreground">Khu vực giám sát</legend>
              <MonitoringAreaEditor area={monitoringArea} onChange={(area) => {
                setMonitoringArea(area)
                setGenError(null)
              }} />
            </fieldset>
          )}

          {/* ───────── Bước 3 ───────── */}
          {step === 3 && pkg && (
            <div className="space-y-6">
              <div data-traffic-status="CLEAR" className="traffic-surface flex flex-col items-center gap-4 rounded-2xl border p-6 text-center">
                <div className="grid size-14 place-items-center rounded-2xl bg-clear/15">
                  <PackageCheck className="size-7 text-clear" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Gói cài đặt Edge Client</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {pkg.agent.name} · {DOCKER_LABEL}{pkg.agent.region && ` · ${pkg.agent.region}`} · {Object.keys(pkg.nodes).length} điểm đo ·{' '}
                    {pkg.connections.length} tuyến
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">Bản demo xuất cấu hình tích hợp dưới dạng <code>{CONFIG_FILE_NAME}</code>.</p>
                <Button id="download-package" size="lg" className="glow-btn h-auto min-h-11 px-4 py-2 text-sm whitespace-normal sm:px-6" onClick={download}>
                  <Download /> Tải gói cài đặt Edge Agent (Đã tích hợp cấu hình)
                </Button>
                {downloaded && (
                  <div id="download-guide" role="status" className="w-full max-w-xl rounded-xl border border-border bg-background p-4 text-left text-sm">
                    <p className="flex items-center gap-2 font-semibold text-clear">
                      <CheckCircle2 className="size-4" /> Cấu hình đã được gửi vào mục tải xuống
                    </p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-foreground">
                      <li>Chép file cấu hình vào thư mục sẽ chạy Edge Client trên thiết bị.</li>
                      <li>Khi có bản phát hành Edge Client, chạy lệnh Docker bên dưới từ thư mục đó.</li>
                      <li>Kiểm tra trạng thái Agent trên trang Mạng lưới Edge Agents sau khi Agent kết nối.</li>
                    </ol>
                  </div>
                )}
              </div>

              <details className="group rounded-xl border border-border">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground">
                  Xem lệnh chạy bằng Docker
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-3 border-t border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Lệnh mẫu dùng image từ bản phát hành Edge Client. Đặt EDGE_CLIENT_IMAGE thành tên và tag của image đó.
                  </p>
                  <CopyLine id="installer-command-docker" command={dockerCommand} />
                </div>
              </details>

              <div className="rounded-xl border border-border">
                <button
                  id="config-preview-toggle"
                  type="button"
                  aria-expanded={showPreview}
                  onClick={() => setShowPreview((s) => !s)}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
                >
                  Xem cấu hình Edge Agent
                  <ChevronDown className={cn('size-4 transition-transform', showPreview && 'rotate-180')} />
                </button>
                {showPreview && (
                  <pre id="config-preview" className="max-h-80 overflow-auto border-t border-border bg-background p-4 font-mono text-[11px] leading-relaxed text-foreground">
                    {json}
                  </pre>
                )}
              </div>
            </div>
          )}
        </CardContent>

        {/* Thanh điều hướng wizard */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          <div className="min-w-0 text-xs text-moderate">
            {step === 1 && !hasAgentName && <span>• Nhập tên Agent</span>}
            {step === 2 && area.errors.length > 0 && (
              <span>
                • {area.errors[0]}
                {area.errors.length > 1 && ` (+${area.errors.length - 1} lỗi khác)`}
              </span>
            )}
            {step === 2 && genError && <span role="alert" className="text-congested">{genError}</span>}
          </div>
          <div className="flex gap-2">
            {step > 1 && (
              <Button id="wizard-back" variant="outline" disabled={generating} onClick={() => setStep(step === 3 ? 2 : 1)}>
                <ArrowLeft /> Quay lại
              </Button>
            )}
            {step === 1 && (
              <Button id="wizard-next-1" className="glow-btn" disabled={!hasAgentName} onClick={() => setStep(2)}>
                Tiếp tục <ArrowRight />
              </Button>
            )}
            {step === 2 && (
              <Button id="wizard-next-2" className="glow-btn" disabled={!area.request || generating} onClick={() => void goToPackage()}>
                {generating ? <Loader2 className="animate-spin" /> : <PackageCheck />} Tạo gói cài đặt
              </Button>
            )}
            {step === 3 && (
              <Link to="/edge-nodes" id="wizard-finish" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-muted">
                Hoàn tất <Check className="size-4" />
              </Link>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
