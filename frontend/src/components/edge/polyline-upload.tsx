import { useLanguage } from '@/i18n/use-language'
import { useMemo, useRef, useState, type DragEvent } from 'react'
import { ArrowLeftRight, Check, FileUp, Route } from 'lucide-react'
import { Polyline } from 'react-leaflet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { polylinesToDraft, previewPolylines, readPolylineFile } from '@/lib/polyline-import'
import type { AreaDraft } from '@/lib/edge-setup'
import AreaMap from '@/components/edge/area-map'

const MAX_FILE_SIZE = 2 * 1024 * 1024

export default function PolylineUpload({ onApply, onClose }: { onApply: (draft: AreaDraft) => string | null; onClose: () => void }) {
  const { messages } = useLanguage()
  const [fileName, setFileName] = useState('')
  const [file, setFile] = useState<ReturnType<typeof readPolylineFile> | null>(null)
  const [swapped, setSwapped] = useState(false)
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<'fileType' | 'fileSize' | 'invalidJson' | 'noGeometry' | 'readError' | null>(null)
  const version = useRef(0)

  const preview = useMemo(() => file ? previewPolylines(file, swapped, messages.upload.route) : null, [file, swapped, messages.upload.route])
  const fit = useMemo(() => preview?.routes.flatMap((route) => route.positions), [preview])

  const readFile = async (next: File) => {
    const current = ++version.current
    setFile(null)
    setApplyError(null)
    setFileError(null)
    setSwapped(false)
    setFileName(next.name)
    setReading(true)
    try {
      if (!/\.(json|geojson)$/i.test(next.name)) return setFileError('fileType')
      if (next.size > MAX_FILE_SIZE) return setFileError('fileSize')
      const contents = await next.text()
      if (version.current !== current) return
      let raw: unknown
      try { raw = JSON.parse(contents) } catch { return setFileError('invalidJson') }
      const result = readPolylineFile(raw)
      if (!result.routes.length) return setFileError('noGeometry')
      setFile(result)
    } catch {
      if (version.current === current) setFileError('readError')
    } finally {
      if (version.current === current) setReading(false)
    }
  }

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDragging(false)
    const first = event.dataTransfer.files[0]
    if (first) void readFile(first)
  }

  const apply = () => {
    if (!preview?.routes.length) return
    const error = onApply(polylinesToDraft(preview.routes, messages.upload))
    if (error) setApplyError(error)
    else onClose()
  }

  const error = fileError ? messages.upload[fileError] : applyError

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_16.5rem]">
      {preview?.routes.length ? (
        <AreaMap id="polyline-preview-map" label={messages.upload.preview} fit={fit}>
          {preview.routes.map((route, index) => (
            <Polyline key={index} positions={route.positions} pathOptions={{ color: 'var(--primary)', weight: 4 }} interactive={false} />
          ))}
        </AreaMap>
      ) : (
        <div className="grid h-56 place-items-center rounded-xl border border-border bg-muted p-5 text-center text-sm text-muted-foreground sm:h-72">
          <div><Route className="mx-auto mb-2 size-6 text-primary" aria-hidden /> {messages.upload.empty}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-3">
        <label
          className={cn('flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-input p-4 text-center text-sm hover:bg-muted focus-within:ring-2 focus-within:ring-ring', dragging && 'border-primary bg-accent')}
          onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <FileUp className="size-5 text-primary" aria-hidden />
          <span className="font-semibold">{messages.upload.choose}</span>
          <span className="text-xs text-muted-foreground">{messages.upload.formats}</span>
          <input type="file" className="sr-only" accept=".json,.geojson,application/json,application/geo+json"
            onChange={(event) => {
              const next = event.target.files?.[0]
              event.target.value = ''
              if (next) void readFile(next)
            }} />
        </label>
        {fileName && <p className="wrap-break-word text-xs text-muted-foreground">{fileName}</p>}
        {reading && <p role="status" className="text-sm text-muted-foreground">{messages.upload.reading}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {file && preview && (
          <>
            <Button variant="outline" aria-pressed={swapped} className="h-auto justify-start py-2 text-left whitespace-normal" onClick={() => { setSwapped(!swapped); setApplyError(null) }}>
              <ArrowLeftRight /> {messages.upload.swap}
            </Button>
            <p role="status" className="text-sm">
              {messages.upload.validRoutes(preview.routes.length)}
              {preview.invalid > 0 && ` · ${messages.upload.invalidRoutes(preview.invalid)}`}
              {swapped && ` · ${messages.upload.swapped}`}
            </p>
            {!preview.routes.length && (
              <p className="text-xs text-muted-foreground">{messages.upload.checkCoordinates}</p>
            )}
            <Button className="h-auto justify-start py-2 text-left whitespace-normal" disabled={!preview.routes.length || reading} onClick={apply}>
              <Check /> {messages.upload.confirm}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
