import { useLanguage } from '@/i18n/use-language'
import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { searchPlaces, toErrorMessage } from '@/services/api'
import type { PlaceSuggestion } from '@/types/traffic'

type SearchState =
  | { status: 'idle' | 'loading' }
  | { status: 'success'; results: PlaceSuggestion[] }
  | { status: 'error'; error: unknown }

export default function PlaceSearch({ onSelect }: { onSelect: (place: PlaceSuggestion) => void }) {
  const { messages } = useLanguage()
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>({ status: 'idle' })
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const timer = useRef<number>(undefined)
  const request = useRef<AbortController>(null)
  const suggestionsId = useId()

  useEffect(() => () => {
    window.clearTimeout(timer.current)
    request.current?.abort()
  }, [])

  const search = (value: string, debounce = false) => {
    window.clearTimeout(timer.current)
    request.current?.abort()
    const keyword = value.trim()
    if (!keyword) {
      setOpen(false)
      setState({ status: 'idle' })
      return
    }

    const controller = new AbortController()
    request.current = controller
    setOpen(true)
    setState({ status: 'loading' })

    const load = async () => {
      try {
        const results = await searchPlaces(keyword, controller.signal)
        if (!controller.signal.aborted) setState({ status: 'success', results })
      } catch (error) {
        if (!controller.signal.aborted) setState({ status: 'error', error })
      }
    }
    if (debounce) timer.current = window.setTimeout(load, 350)
    else void load()
  }

  const select = (place: PlaceSuggestion, keyboard: boolean) => {
    onSelect(place)
    setQuery(place.label)
    setState({ status: 'idle' })
    if (keyboard) input.current?.focus()
    else input.current?.blur()
    setOpen(false)
  }

  return (
    <form
      role="search"
      aria-label={messages.picker.searchLabel}
      className="relative z-[1000]"
      onSubmit={(event) => { event.preventDefault(); search(query) }}
      onFocus={() => { if (state.status !== 'idle') setOpen(true) }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          input.current?.focus()
          setOpen(false)
        }
      }}
    >
      <div className="flex gap-2">
        <Input
          ref={input}
          type="search"
          aria-label={messages.picker.searchName}
          aria-controls={open ? suggestionsId : undefined}
          autoComplete="off"
          placeholder={messages.picker.searchPlaceholder}
          className="h-10 min-w-0 bg-background"
          value={query}
          onChange={(event) => {
            const value = event.target.value
            setQuery(value)
            search(value, true)
          }}
        />
        <Button type="submit" variant="outline" className="h-10" disabled={!query.trim()} aria-label={messages.common.search}>
          <Search aria-hidden /> <span className="hidden sm:inline">{messages.common.search}</span>
        </Button>
      </div>
      {open && state.status !== 'idle' && (
        <div id={suggestionsId} className="absolute inset-x-0 top-full mt-1 max-h-[50dvh] overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-panel">
          {state.status === 'loading' && (
            <p role="status" className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden /> {messages.picker.searching}
            </p>
          )}
          {state.status === 'error' && <p role="alert" className="px-3 py-2 text-sm text-destructive">{toErrorMessage(state.error, messages.api)}</p>}
          {state.status === 'success' && (state.results.length === 0 ? (
            <p role="status" className="px-3 py-2 text-sm text-muted-foreground">{messages.picker.noPlaces}</p>
          ) : (
            <ul aria-label={messages.picker.suggestions}>
              {state.results.map((place) => (
                <li key={place.id}>
                  <button type="button" onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => select(place, event.detail === 0)}
                    className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0 wrap-break-word">
                      <span className="block text-sm font-medium">{place.label}</span>
                      {place.address && place.address !== place.label && (
                        <span className="block text-xs text-muted-foreground">{place.address}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}
    </form>
  )
}
