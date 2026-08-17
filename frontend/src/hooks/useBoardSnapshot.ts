import { useEffect, useRef, useState } from 'react'
import { ApiError, getBoardSnapshot } from '../api/client'
import type { BoardSnapshot } from '../types/finnhub'

const POLL_INTERVAL_MS = 20_000

interface State {
  data: BoardSnapshot | null
  error: string | null
  loading: boolean
  lastUpdated: number | null
}

export function useBoardSnapshot(symbol: string, hasApiKey: boolean) {
  const [state, setState] = useState<State>({
    data: null,
    error: null,
    loading: true,
    lastUpdated: null,
  })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchOnce() {
      if (!hasApiKey) {
        setState((s) => ({ ...s, loading: false, error: 'No API key set.' }))
        return
      }
      try {
        const data = await getBoardSnapshot(symbol)
        if (cancelled) return
        setState({ data, error: null, loading: false, lastUpdated: Date.now() })
      } catch (err) {
        if (cancelled) return
        const message =
          err instanceof ApiError ? err.message : 'Failed to fetch data.'
        setState((s) => ({ ...s, error: message, loading: false }))
      }
    }

    fetchOnce()
    timerRef.current = setInterval(fetchOnce, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [symbol, hasApiKey])

  return state
}
