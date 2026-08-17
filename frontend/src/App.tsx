import { useState } from 'react'
import { getStoredApiKey } from './api/client'
import { SettingsModal } from './components/SettingsModal'
import { TickerSearch } from './components/TickerSearch'
import { VisionBoard } from './components/VisionBoard'
import { useLocalStorage } from './hooks/useLocalStorage'
import type { WatchlistItem } from './types/watchlist'
import './App.css'

const DEFAULT_WATCHLIST: WatchlistItem[] = []

function App() {
  const [apiKey, setApiKey] = useState(getStoredApiKey())
  const [settingsOpen, setSettingsOpen] = useState(!apiKey)
  const [watchlist, setWatchlist] = useLocalStorage<WatchlistItem[]>(
    'vision-board:watchlist',
    DEFAULT_WATCHLIST,
  )

  const hasApiKey = apiKey.trim().length > 0

  function handleAdd(symbol: string, description: string) {
    setWatchlist((prev) => {
      if (prev.some((item) => item.symbol === symbol)) return prev
      return [...prev, { symbol, description }]
    })
  }

  function handleRemove(symbol: string) {
    setWatchlist((prev) => prev.filter((item) => item.symbol !== symbol))
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-brand">
          <span className="app-header-dot" />
          <h1>Vision Board</h1>
        </div>

        <div className="app-header-search">
          <TickerSearch hasApiKey={hasApiKey} onAdd={handleAdd} />
        </div>

        <div className="app-header-actions">
          <span className={`key-badge ${hasApiKey ? 'key-badge-ok' : 'key-badge-missing'}`}>
            {hasApiKey ? 'API key set' : 'No API key'}
          </span>
          <button
            className="settings-trigger"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      <main className="app-main">
        <VisionBoard items={watchlist} hasApiKey={hasApiKey} onRemove={handleRemove} />
      </main>

      <SettingsModal
        open={settingsOpen}
        currentKey={apiKey}
        onClose={() => setSettingsOpen(false)}
        onSave={(key) => setApiKey(key)}
      />
    </div>
  )
}

export default App
