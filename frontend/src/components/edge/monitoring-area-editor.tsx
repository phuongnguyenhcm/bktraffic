import { useLanguage } from '@/i18n/use-language'
import { useState } from 'react'
import { ArrowRightLeft, FileUp, MapPinPlus, Plus, Route, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { appendArea, MAX_LINKS, MAX_POINTS, nextLinkKey, type AreaDraft, type MonitoringArea, type MonitoringLink } from '@/lib/edge-setup'
import MapPointPicker from '@/components/edge/map-point-picker'
import PolylineUpload from '@/components/edge/polyline-upload'

interface Props {
  area: MonitoringArea
  onChange: (area: MonitoringArea) => void
}

const selectClass = 'h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-2 focus-visible:outline-ring'

export default function MonitoringAreaEditor({ area, onChange }: Props) {
  const { messages } = useLanguage()
  const [modal, setModal] = useState<'map' | 'upload' | null>(null)
  const { points, links } = area
  const names = new Map(points.map(({ id, name }) => [id, name]))
  const close = () => setModal(null)
  const apply = (draft: AreaDraft): string | null => {
    const updated = appendArea(area, draft)
    if (!updated) return messages.setup.areaLimit
    if (updated.points.length === points.length && updated.links.every((link, index) => link === links[index])) {
      return messages.editor.duplicate
    }
    onChange(updated)
    return null
  }
  const removePoint = (id: string) => onChange({
    points: points.filter((point) => point.id !== id),
    links: links.filter((link) => link.from !== id && link.to !== id),
  })
  const updateLink = (key: number, patch: Partial<MonitoringLink>) => onChange({
    points,
    links: links.map((link) => link.key === key ? { ...link, ...patch } : link),
  })
  const addLink = () => onChange({
    points,
    links: [...links, { key: nextLinkKey(), from: '', to: '', isOneWay: false, geometryMode: 'auto' }],
  })

  const actions = (
    <div className="flex flex-wrap gap-2">
      <DialogTrigger render={<Button disabled={points.length >= MAX_POINTS} />} onClick={() => setModal('map')}>
        <Plus /> {messages.editor.auto}
      </DialogTrigger>
      <DialogTrigger render={<Button variant="outline" disabled={points.length >= MAX_POINTS} />} onClick={() => setModal('upload')}>
        <FileUp /> {messages.editor.manual}
      </DialogTrigger>
    </div>
  )

  return (
    <Dialog open={modal !== null} onOpenChange={(open) => { if (!open) close() }}>
      <div className={points.length
        ? 'mb-3 flex flex-wrap items-center justify-between gap-3'
        : 'flex flex-col items-start gap-4 rounded-2xl border border-dashed border-border bg-muted/50 p-5 sm:p-8'}>
        {points.length ? (
          <h3 id="monitoring-points" className="font-semibold text-foreground">{messages.editor.points(points.length)}</h3>
        ) : (
          <>
            <div className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
              <MapPinPlus className="size-5" aria-hidden />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{messages.editor.empty}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{messages.editor.emptyHint}</p>
            </div>
          </>
        )}
        {actions}
      </div>
      {points.length > 0 && (
        <div className="space-y-5">
          <section aria-labelledby="monitoring-points">
            <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {points.map((point) => (
                <li key={point.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem_auto]">
                  <span className="wrap-break-word text-sm font-medium text-foreground">{point.name}</span>
                  <span className="col-start-1 row-start-2 font-mono text-xs tabular-nums text-muted-foreground sm:col-auto sm:row-auto">
                    {point.coordinates[0].toFixed(6)}, {point.coordinates[1].toFixed(6)}
                  </span>
                  <span className="col-start-1 row-start-3 text-xs text-muted-foreground sm:col-auto sm:row-auto">{point.speedLimitKmh} km/h</span>
                  <Button className="col-start-2 row-span-3 row-start-1 sm:col-auto sm:row-auto" variant="ghost" size="icon-sm"
                    aria-label={messages.editor.removePoint(point.name)} onClick={() => removePoint(point.id)}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          </section>

          {points.length >= 2 && (
            <section aria-labelledby="monitoring-links" className="space-y-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="monitoring-links" className="font-semibold text-foreground">{messages.editor.connections(links.length)}</h3>
                <Button variant="outline" size="sm" disabled={links.length >= MAX_LINKS} onClick={addLink}><Plus /> {messages.editor.addConnection}</Button>
              </div>
              {!links.length && <p className="text-sm text-muted-foreground">{messages.editor.optionalConnection}</p>}
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {links.map((link, index) => (
                  <li key={link.key} className="rounded-lg border border-border bg-muted/50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="outline"><Route aria-hidden /> {link.geometryMode === 'manual' ? messages.editor.manualGeometry : messages.editor.autoGeometry}</Badge>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Switch checked={link.isOneWay} size="sm" onCheckedChange={(checked) => updateLink(link.key, { isOneWay: checked })} />
                          {messages.editor.oneWay}
                        </label>
                        <Button variant="ghost" size="icon-sm" aria-label={messages.editor.removeConnection(index + 1)}
                          onClick={() => onChange({ points, links: links.filter(({ key }) => key !== link.key) })}>
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
                      {(['from', 'to'] as const).map((side) => (
                        <div key={side} className={side === 'to' ? 'col-start-3 row-start-1' : 'col-start-1'}>
                          {link.geometryMode === 'manual' ? (
                            <span className="wrap-break-word">{names.get(link[side])}</span>
                          ) : (
                            <select aria-label={side === 'from' ? messages.editor.connectionStart(index + 1) : messages.editor.connectionEnd(index + 1)}
                              className={selectClass} value={link[side]} onChange={(event) => updateLink(link.key, { [side]: event.target.value })}>
                              <option value="">{messages.editor.selectPoint}</option>
                              {points.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                            </select>
                          )}
                        </div>
                      ))}
                      <ArrowRightLeft className="col-start-2 row-start-1 size-3.5 text-muted-foreground" aria-hidden />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {modal && (
        <DialogContent className={modal === 'map'
          ? 'flex h-[92dvh] w-[96vw] max-w-none flex-col overflow-hidden p-5 sm:max-w-none'
          : 'max-h-[92dvh] w-[95vw] max-w-6xl overflow-y-auto sm:max-w-6xl'}>
          <DialogHeader className="pr-9">
            <DialogTitle>{modal === 'map' ? messages.editor.auto : messages.editor.manual}</DialogTitle>
            <DialogDescription>
              {modal === 'map' ? messages.editor.autoDescription : messages.editor.manualDescription}
            </DialogDescription>
          </DialogHeader>
          {modal === 'map'
            ? <MapPointPicker onApply={apply} onClose={close} points={points} />
            : <PolylineUpload onApply={apply} onClose={close} />}
        </DialogContent>
      )}
    </Dialog>
  )
}
