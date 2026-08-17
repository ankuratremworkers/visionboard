import { TickerCard } from './TickerCard'
import type { WatchlistItem } from '../types/watchlist'
import './VisionBoard.css'

interface Props {
  items: WatchlistItem[]
  hasApiKey: boolean
  onRemove: (symbol: string) => void
}

export function VisionBoard({ items, hasApiKey, onRemove }: Props) {
  if (items.length === 0) {
    return (
      <div className="vision-board-empty">
        <p>Your board is empty.</p>
        <p className="dim">Search for a ticker above to start tracking live metrics.</p>
      </div>
    )
  }

  return (
    <div className="vision-board-grid">
      {items.map((item) => (
        <TickerCard
          key={item.symbol}
          symbol={item.symbol}
          description={item.description}
          hasApiKey={hasApiKey}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}
