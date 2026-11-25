import { useEffect, useEffectEvent, useState } from 'react'
import { toErrorMessage } from '@/services/api'

interface Result<T> {
  key: string | number
  revision: number
  data: T | null
  error: string | null
}

export function useAsync<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  key: string | number,
  pollMs?: number,
) {
  const [result, setResult] = useState<Result<T> | null>(null)
  const [revision, setRevision] = useState(0)
  const fetchLatest = useEffectEvent(fetcher)

  useEffect(() => {
    const controller = new AbortController()
    let timer: number | undefined

    async function run() {
      try {
        const data = await fetchLatest(controller.signal)
        if (!controller.signal.aborted) setResult({ key, revision, data, error: null })
      } catch (error) {
        if (!controller.signal.aborted) {
          setResult((previous) => ({
            key,
            revision,
            data: previous?.data ?? null,
            error: toErrorMessage(error),
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
    error: settled ? result.error : null,
    reload: () => setRevision((value) => value + 1),
  }
}
