import { useEffect, useMemo, useState } from 'react'
import { Download, FileJson, Import, Link2, Loader2, Plus, Route, Trash2, Wand2 } from 'lucide-react'
import { fetchTrafficMap, generateEdgeConfig, toErrorMessage } from '@/services/api'
import type { ConfigConnectionInput, ConfigNodeInput, GenerateConfigRequest, GenerateConfigResponse, GeometryMode, LatLon } from '@/types/traffic'
import ErrorState from '@/components/common/error-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface NodeRow {
  key: number
  id: string
  lat: string
  lon: string
  speedLimit: string
}

interface ConnRow {
  key: number
  from: string
  to: string
  isOneWay: boolean
  polylineText: string
}

let seq = 0
const nextKey = (): number => ++seq

const emptyNode = (): NodeRow => ({ key: nextKey(), id: '', lat: '', lon: '', speedLimit: '40' })
const emptyConn = (): ConnRow => ({ key: nextKey(), from: '', to: '', isOneWay: false, polylineText: '' })

/** Parse polyline dán vào: JSON `[[lat, lon], ...]` */
function parsePolyline(text: string): { value: LatLon[] | null; error: string | null } {
  if (!text.trim()) return { value: null, error: 'Chưa nhập polyline' }
  try {
    const raw: unknown = JSON.parse(text)
    const ok =
      Array.isArray(raw) &&
      raw.length >= 2 && raw.length <= 2000 &&
      raw.every((p) => Array.isArray(p) && p.length === 2 && p.every((x) => typeof x === 'number' && Number.isFinite(x)))
    if (!ok) return { value: null, error: 'Cần từ 2 đến 2.000 điểm dạng [[lat, lon], ...]' }
    const pts = raw as LatLon[]
    if (pts.some(([la, lo]) => Math.abs(la) > 90 || Math.abs(lo) > 180)) return { value: null, error: 'Toạ độ ngoài phạm vi' }
    return { value: pts, error: null }
  } catch {
    return { value: null, error: 'JSON không hợp lệ' }
  }
}

interface BuildResult {
  request: GenerateConfigRequest | null
  errors: string[]
}

function buildRequest(nodes: NodeRow[], conns: ConnRow[], mode: GeometryMode): BuildResult {
  const errors: string[] = []
  const outNodes: ConfigNodeInput[] = []
  const ids = new Set<string>()
  nodes.forEach((n, i) => {
    const id = n.id.trim()
    const lat = Number(n.lat)
    const lon = Number(n.lon)
    const sl = n.speedLimit.trim() === '' ? undefined : Number(n.speedLimit)
    if (!id) return errors.push(`Node #${i + 1}: thiếu ID`)
    if (!/^[A-Za-z0-9_+\-.]{1,64}$/.test(id)) return errors.push(`Node "${id}": ID chỉ gồm chữ, số, _ + - .`)
    if (ids.has(id)) return errors.push(`Node "${id}" bị trùng`)
    if (!n.lat.trim() || !Number.isFinite(lat) || Math.abs(lat) > 90) return errors.push(`Node "${id}": lat không hợp lệ`)
    if (!n.lon.trim() || !Number.isFinite(lon) || Math.abs(lon) > 180) return errors.push(`Node "${id}": lon không hợp lệ`)
    if (sl !== undefined && (!Number.isInteger(sl) || sl < 5 || sl > 150)) return errors.push(`Node "${id}": speed_limit 5–150 km/h`)
    ids.add(id)
    outNodes.push({ id, lat, lon, speedLimitKmh: sl })
  })

  const outConns: ConfigConnectionInput[] = []
  conns.forEach((c, i) => {
    const label = `Kết nối #${i + 1}`
    if (!c.from || !c.to) return errors.push(`${label}: chọn đủ 2 node`)
    if (c.from === c.to) return errors.push(`${label}: hai đầu trùng nhau`)
    if (!ids.has(c.from) || !ids.has(c.to)) return errors.push(`${label}: node không tồn tại`)
    const conn: ConfigConnectionInput = { from: c.from, to: c.to, isOneWay: c.isOneWay, geometryMode: mode }
    if (mode === 'manual') {
      const p = parsePolyline(c.polylineText)
      if (!p.value) return errors.push(`${label} (${c.from} → ${c.to}): ${p.error}`)
      conn.polyline = p.value
    }
    outConns.push(conn)
  })

  if (outNodes.length === 0) errors.push('Cần ít nhất một node')
  return { request: errors.length ? null : { nodes: outNodes, connections: outConns }, errors }
}

interface Preview {
  request: GenerateConfigRequest
  attempt: number
  result: GenerateConfigResponse | null
  error: string | null
}

export default function ConfigBuilder() {
  const [mode, setMode] = useState<GeometryMode>('auto')
  const [nodes, setNodes] = useState<NodeRow[]>(() => [emptyNode(), emptyNode()])
  const [conns, setConns] = useState<ConnRow[]>(() => [emptyConn()])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const built = useMemo(() => buildRequest(nodes, conns, mode), [nodes, conns, mode])
  const nodeIds = [...new Set(nodes.map((n) => n.id.trim()).filter(Boolean))]
  const request = built.request
  const latest = preview?.request === request && preview.attempt === attempt ? preview : null
  const result = latest?.result
  const generating = !!request && !latest

  // Sinh bản xem trước từ Backend (debounce) khi dữ liệu hợp lệ
  useEffect(() => {
    if (!request) return
    const controller = new AbortController()
    const t = window.setTimeout(() => {
      generateEdgeConfig(request, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setPreview({ request, attempt, result, error: null })
        })
        .catch((e: unknown) => {
          if (!controller.signal.aborted) {
            setPreview({ request, attempt, result: null, error: toErrorMessage(e) })
          }
        })
    }, 400)
    return () => {
      controller.abort()
      window.clearTimeout(t)
    }
  }, [request, attempt])

  const importFromNetwork = async (): Promise<void> => {
    setImporting(true)
    setImportError(null)
    try {
      const map = await fetchTrafficMap(10)
      setNodes(map.nodes.map((n) => ({ key: nextKey(), id: n.id, lat: String(n.lat), lon: String(n.lon), speedLimit: String(n.speedLimitKmh) })))
      setConns(
        map.edges.map((e) => ({
          key: nextKey(),
          from: e.fromNodeId,
          to: e.toNodeId,
          isOneWay: e.isOneWay,
          polylineText: JSON.stringify(e.polyline),
        })),
      )
    } catch (e) {
      setImportError(toErrorMessage(e))
    } finally {
      setImporting(false)
    }
  }

  const updateNode = (node: NodeRow, patch: Partial<NodeRow>): void => {
    const previousId = node.id.trim()
    const nextId = patch.id?.trim()
    if (previousId && nextId !== undefined && previousId !== nextId) {
      setConns((rows) => rows.map((row) => ({
        ...row,
        from: row.from === previousId ? nextId : row.from,
        to: row.to === previousId ? nextId : row.to,
      })))
    }
    setNodes((rows) => rows.map((row) => (row.key === node.key ? { ...row, ...patch } : row)))
  }
  const updateConn = (key: number, patch: Partial<ConnRow>): void => setConns((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)))

  const json = result ? JSON.stringify(result.config, null, 2) : ''
  const download = (): void => {
    if (!result) return
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: result.fileName })
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const inputCls = 'h-8 bg-ink-950/70 text-xs'
  const selectCls = 'h-8 w-full min-w-0 rounded-lg border border-input bg-ink-950/70 px-2 text-xs text-white outline-none focus-visible:border-ring'

  return (
    <section aria-labelledby="config-title" className="grid gap-6 xl:grid-cols-5">
      <Card className="glass gap-4 py-5 ring-0 xl:col-span-3">
        <CardHeader className="px-5">
          <CardTitle id="config-title" className="flex items-center gap-2 text-xl text-white">
            <Wand2 className="size-5 text-brand" /> Công cụ tạo target.json
          </CardTitle>
          <CardDescription>Khai báo các điểm đo (node) và đường nối giữa chúng cho Edge Agent của bạn.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={mode} onValueChange={(value) => {
              if (value === 'auto' || value === 'manual') setMode(value)
            }} className="max-w-full">
              <TabsList aria-label="Chế độ hình học" className="h-auto max-w-full flex-wrap justify-start bg-ink-950/70 p-1">
                <TabsTrigger id="mode-auto" value="auto" className="gap-1.5 px-3 py-1.5 text-xs data-active:bg-brand/15 data-active:text-brand">
                  <Route className="size-3.5" /> Tự động trích xuất (Auto)
                </TabsTrigger>
                <TabsTrigger id="mode-manual" value="manual" className="gap-1.5 px-3 py-1.5 text-xs data-active:bg-brand-2/15 data-active:text-brand-2">
                  <Link2 className="size-3.5" /> Thủ công (Manual – Nâng cao)
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button id="config-import" variant="outline" size="sm" onClick={() => void importFromNetwork()} disabled={importing}>
              {importing ? <Loader2 className="animate-spin" /> : <Import />} Nạp mạng lưới hiện tại
            </Button>
          </div>
          {importError && <p role="alert" className="text-sm text-congested">{importError}</p>}
          <p className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs text-muted-foreground">
            {mode === 'auto'
              ? 'Auto: chỉ cần toạ độ node và các cặp kết nối — Backend tự trích xuất hình học đường thật bằng OSRM và cache lại.'
              : 'Manual: cung cấp polyline [[lat, lon], ...] cho từng kết nối — dùng khi tuyến đường đặc thù hoặc định tuyến tự động không chính xác.'}
          </p>

          {/* Nodes */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="eyebrow">Nodes ({nodes.length})</span>
              <Button id="node-add" variant="ghost" size="xs" disabled={nodes.length >= 500} onClick={() => setNodes((l) => [...l, emptyNode()])}>
                <Plus /> Thêm node
              </Button>
            </div>
            <div className="hidden grid-cols-[1.6fr_1fr_1fr_0.7fr_auto] gap-2 px-1 pb-1 text-[10px] text-slate-500 uppercase sm:grid">
              <span>ID node</span>
              <span>Lat</span>
              <span>Lon</span>
              <span>Speed limit</span>
              <span className="w-8" />
            </div>
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {nodes.map((n, i) => (
                <li key={n.key} className="grid grid-cols-2 gap-2 sm:grid-cols-[1.6fr_1fr_1fr_0.7fr_auto]">
                  <Input id={`node-${i}-id`} aria-label={`ID node ${i + 1}`} className={cn(inputCls, 'col-span-2 sm:col-span-1')} placeholder="vd: LyThuongKiet+CMT8" value={n.id} onChange={(e) => updateNode(n, { id: e.target.value })} />
                  <Input id={`node-${i}-lat`} aria-label={`Vĩ độ node ${i + 1}`} className={inputCls} inputMode="decimal" placeholder="10.7836" value={n.lat} onChange={(e) => updateNode(n, { lat: e.target.value })} />
                  <Input id={`node-${i}-lon`} aria-label={`Kinh độ node ${i + 1}`} className={inputCls} inputMode="decimal" placeholder="106.6542" value={n.lon} onChange={(e) => updateNode(n, { lon: e.target.value })} />
                  <Input id={`node-${i}-speed`} aria-label={`Tốc độ giới hạn node ${i + 1} (km/h)`} className={inputCls} inputMode="numeric" placeholder="40" value={n.speedLimit} onChange={(e) => updateNode(n, { speedLimit: e.target.value })} />
                  <Button variant="ghost" size="icon-sm" aria-label="Xoá node" onClick={() => setNodes((l) => l.filter((x) => x.key !== n.key))}>
                    <Trash2 className="text-slate-500" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          <Separator className="bg-white/5" />

          {/* Connections */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="eyebrow">Kết nối ({conns.length})</span>
              <Button id="conn-add" variant="ghost" size="xs" disabled={conns.length >= 2000} onClick={() => setConns((l) => [...l, emptyConn()])}>
                <Plus /> Thêm kết nối
              </Button>
            </div>
            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {conns.map((c, i) => {
                const poly = mode === 'manual' ? parsePolyline(c.polylineText) : null
                return (
                  <li key={c.key} className="rounded-xl border border-white/5 bg-white/[0.02] p-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_auto]">
                      <select id={`conn-${i}-from`} aria-label={`Node bắt đầu của kết nối ${i + 1}`} className={selectCls} value={c.from} onChange={(e) => updateConn(c.key, { from: e.target.value })}>
                        <option value="">— từ node —</option>
                        {nodeIds.map((id) => (
                          <option key={id} value={id}>{id}</option>
                        ))}
                      </select>
                      <span className="text-xs text-brand">{c.isOneWay ? '→' : '↔'}</span>
                      <select id={`conn-${i}-to`} aria-label={`Node kết thúc của kết nối ${i + 1}`} className={selectCls} value={c.to} onChange={(e) => updateConn(c.key, { to: e.target.value })}>
                        <option value="">— đến node —</option>
                        {nodeIds.map((id) => (
                          <option key={id} value={id}>{id}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1.5 text-[11px] whitespace-nowrap text-muted-foreground">
                        <Switch id={`conn-${i}-oneway`} size="sm" checked={c.isOneWay} onCheckedChange={(v) => updateConn(c.key, { isOneWay: v })} />
                        1 chiều
                      </label>
                      <Button className="col-start-3 justify-self-end sm:col-start-auto" variant="ghost" size="icon-sm" aria-label="Xoá kết nối" onClick={() => setConns((l) => l.filter((x) => x.key !== c.key))}>
                        <Trash2 className="text-slate-500" />
                      </Button>
                    </div>
                    {mode === 'manual' && (
                      <div className="mt-2">
                        <Textarea
                          id={`conn-${i}-polyline`}
                          aria-label={`Polyline của kết nối ${i + 1}`}
                          className="min-h-16 bg-ink-950/70 font-mono text-[11px]"
                          placeholder="[[10.7836, 106.6542], [10.7801, 106.6575], [10.7745, 106.6621]]"
                          value={c.polylineText}
                          aria-invalid={!!poly?.error && c.polylineText !== ''}
                          onChange={(e) => updateConn(c.key, { polylineText: e.target.value })}
                        />
                        <p className={cn('mt-1 text-[10px]', poly?.value ? 'text-clear' : 'text-slate-500')}>
                          {poly?.value ? `✓ ${poly.value.length} điểm` : poly?.error}
                        </p>
                      </div>
                    )}
                  </li>
                )
              })}
              {conns.length === 0 && <li className="py-3 text-center text-xs text-slate-500">Chưa có kết nối — node sẽ hiển thị độc lập.</li>}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="glass gap-0 overflow-hidden py-0 ring-0 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <FileJson className="size-4 text-moderate" />
            <span className="font-mono">target.json</span>
            {generating && <Loader2 className="size-3.5 animate-spin text-slate-500" />}
          </div>
          <Button id="download-config" className="glow-btn" size="sm" onClick={download} disabled={!result}>
            <Download /> Download target.json
          </Button>
        </div>
        {result && built.request && (
          <div className="flex gap-4 border-b border-white/5 px-5 py-2 text-[11px] text-muted-foreground">
            <span>{result.stats.nodeCount} nodes</span>
            <span>{result.stats.connectionCount} kết nối</span>
            <span>{result.stats.manualConnectionCount} manual</span>
          </div>
        )}
        <div aria-busy={generating} className="relative min-h-80 flex-1 bg-ink-950/70">
          {built.errors.length > 0 ? (
            <ul className="space-y-1 p-5 text-xs text-moderate">
              {built.errors.slice(0, 8).map((e) => (
                <li key={e}>• {e}</li>
              ))}
              {built.errors.length > 8 && <li>… và {built.errors.length - 8} lỗi khác</li>}
            </ul>
          ) : latest?.error ? (
            <ErrorState compact message={latest.error} onRetry={() => setAttempt((value) => value + 1)} />
          ) : result ? (
            <pre id="config-preview" className="absolute inset-0 overflow-auto p-5 font-mono text-[11.5px] leading-relaxed text-slate-300">
              {json}
            </pre>
          ) : (
            <div role="status" aria-label="Đang tạo bản xem trước" className="space-y-3 p-5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}
        </div>
        <div className="border-t border-white/5 px-5 py-3 font-mono text-[11px] text-slate-500">$ fedtraffic-edge --config ./target.json</div>
      </Card>
    </section>
  )
}
