import { useBoardSnapshot } from '../hooks/useBoardSnapshot'
import './TickerCard.css'

interface Props {
  symbol: string
  description?: string
  hasApiKey: boolean
  onRemove: (symbol: string) => void
}

function formatNumber(n: number | null, opts: Intl.NumberFormatOptions = {}): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', opts).format(n)
}

function formatMarketCap(n: number | null): string {
  if (n === null || n === undefined) return '—'
  // Finnhub returns marketCapitalization in millions of the reporting currency
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}T`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}B`
  return `$${n.toFixed(0)}M`
}

function timeAgo(ts: number | null): string {
  if (!ts) return '—'
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ago`
}

export function TickerCard({ symbol, description, hasApiKey, onRemove }: Props) {
  const { data, error, loading, lastUpdated } = useBoardSnapshot(symbol, hasApiKey)

  const isPositive = (data?.quote.change ?? 0) >= 0

  return (
    <div className="ticker-card">
      <button className="ticker-card-remove" onClick={() => onRemove(symbol)} aria-label={`Remove ${symbol}`}>
        ×
      </button>

      <div className="ticker-card-header">
        {data?.profile.logo ? (
          <img className="ticker-card-logo" src={data.profile.logo} alt="" />
        ) : (
          <div className="ticker-card-logo ticker-card-logo-placeholder">{symbol.slice(0, 2)}</div>
        )}
        <div className="ticker-card-title">
          <span className="ticker-card-symbol">{symbol}</span>
          <span className="ticker-card-name">{data?.profile.name ?? description ?? '—'}</span>
        </div>
      </div>

      {loading && !data && <div className="ticker-card-loading">Loading live data…</div>}

      {error && (!data || !loading) && (
        <div className="ticker-card-error">{error}</div>
      )}

      {data && (
        <>
          <div className="ticker-card-price-row">
            <span className="ticker-card-price">
              {data.profile.currency ?? '$'} {formatNumber(data.quote.current_price, { maximumFractionDigits: 2 })}
            </span>
            <span className={`ticker-card-change ${isPositive ? 'positive' : 'negative'}`}>
              {isPositive ? '▲' : '▼'} {formatNumber(Math.abs(data.quote.change ?? 0), { maximumFractionDigits: 2 })}
              {' '}({formatNumber(data.quote.percent_change, { maximumFractionDigits: 2 })}%)
            </span>
          </div>

          <div className="ticker-card-grid">
            <div className="metric">
              <span className="metric-label">Open</span>
              <span className="metric-value">{formatNumber(data.quote.open, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Prev Close</span>
              <span className="metric-value">{formatNumber(data.quote.previous_close, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Day High</span>
              <span className="metric-value">{formatNumber(data.quote.high, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Day Low</span>
              <span className="metric-value">{formatNumber(data.quote.low, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="metric">
              <span className="metric-label">52W High</span>
              <span className="metric-value">{formatNumber(data.metrics.week_52_high, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="metric">
              <span className="metric-label">52W Low</span>
              <span className="metric-value">{formatNumber(data.metrics.week_52_low, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="metric">
              <span className="metric-label">P/E (TTM)</span>
              <span className="metric-value">{formatNumber(data.metrics.pe_ttm, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Market Cap</span>
              <span className="metric-value">{formatMarketCap(data.profile.market_capitalization)}</span>
            </div>
          </div>

          <div className="ticker-card-footer">
            <span className="ticker-card-industry">{data.profile.industry ?? ''}</span>
            <span className="ticker-card-updated">
              <span className="live-dot" /> {timeAgo(lastUpdated)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
