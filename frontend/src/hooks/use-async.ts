import { useEffect, useEffectEvent, useState } from 'react'
import { toErrorMessage } from '@/services/api'
import { useLanguage } from '@/i18n/use-language'

interface Result<T> {
  key: string | number
  revision: number
  data: T | null
  failure: { error: unknown } | null
}

export function useAsync<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  key: string | number,
  pollMs?: number,
) {
  const { messages } = useLanguage()
  const [result, setResult] = useState<Result<T> | null>(null)
  const [revision, setRevision] = useState(0)
  const fetchLatest = useEffectEvent(fetcher)

  useEffect(() => {
    const controller = new AbortController()
    let timer: number | undefined

    async function run() {
      try {
        const data = await fetchLatest(controller.signal)
        if (!controller.signal.aborted) setResult({ key, revision, data, failure: null })
      } catch (error) {
        if (!controller.signal.aborted) {
          setResult((previous) => ({
            key,
            revision,
            data: previous?.data ?? null,
            failure: { error },
          }))
        }
      } finally {
        if (pollMs && !controller.signal.aborted) timer = window.setTimeout(run, pollMs)
      }
    }

    void run()
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [key, pollMs, revision])

  const settled = result?.key === key && result.revision === revision
  return {
    data: result?.data ?? null,
    loading: !settled,
    error: settled && result.failure ? toErrorMessage(result.failure.error, messages.api) : null,
    reload: () => setRevision((value) => value + 1),
  }
}
