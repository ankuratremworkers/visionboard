import { useEffect, useRef, useState } from 'react'
import { ApiError, searchSymbols } from '../api/client'
import type { SearchResult } from '../types/finnhub'
import './TickerSearch.css'

interface Props {
  hasApiKey: boolean
  onAdd: (symbol: string, description: string) => void
}

export function TickerSearch({ hasApiKey, onAdd }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = query.trim()
    if (trimmed.length < 1) {
      setResults([])
      setError(null)
      return
    }

    if (!hasApiKey) {
      setError('Set your Finnhub API key in Settings first.')
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await searchSymbols(trimmed)
        setResults(res.results.slice(0, 12))
        setOpen(true)
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Search failed.'
        setError(message)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, hasApiKey])

  function handleSelect(result: SearchResult) {
    onAdd(result.symbol, result.description)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="ticker-search" ref={containerRef}>
      <input
        className="ticker-search-input"
        placeholder="Search any ticker (e.g. AAPL, TSLA, BINANCE:BTCUSDT)…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {loading && <div className="ticker-search-spinner" />}

      {open && (error || results.length > 0) && (
        <div className="ticker-search-dropdown scrollbar-thin">
          {error && <div className="ticker-search-error">{error}</div>}
          {!error &&
            results.map((r) => (
              <button
                key={r.symbol}
                className="ticker-search-item"
                onClick={() => handleSelect(r)}
              >
                <span className="ticker-search-symbol">{r.display_symbol}</span>
                <span className="ticker-search-desc">{r.description}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
