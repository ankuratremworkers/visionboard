import { useState } from 'react'
import { ApiError, setStoredApiKey, verifyKey } from '../api/client'
import './SettingsModal.css'

interface Props {
  open: boolean
  currentKey: string
  onClose: () => void
  onSave: (key: string) => void
}

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string }

export function SettingsModal({ open, currentKey, onClose, onSave }: Props) {
  const [draft, setDraft] = useState(currentKey)
  const [test, setTest] = useState<TestState>({ status: 'idle' })

  if (!open) return null

  async function handleTest() {
    setTest({ status: 'testing' })
    setStoredApiKey(draft.trim())
    try {
      const result = await verifyKey()
      setTest(
        result.valid
          ? { status: 'ok', message: result.message }
          : { status: 'error', message: result.message },
      )
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Connection failed.'
      setTest({ status: 'error', message })
    }
  }

  function handleSave() {
    const trimmed = draft.trim()
    setStoredApiKey(trimmed)
    onSave(trimmed)
    onClose()
  }

  function handleClear() {
    setDraft('')
    setStoredApiKey('')
    onSave('')
    setTest({ status: 'idle' })
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className="settings-desc">
          Your Finnhub API key is stored only in this browser's local storage. It
          is sent to the backend per-request and is never saved on disk there.
        </p>

        <label className="settings-label" htmlFor="api-key-input">
          Finnhub API Key
        </label>
        <input
          id="api-key-input"
          className="settings-input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste your Finnhub API key"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />

        {test.status === 'ok' && (
          <div className="settings-status settings-status-ok">✓ {test.message}</div>
        )}
        {test.status === 'error' && (
          <div className="settings-status settings-status-error">✕ {test.message}</div>
        )}

        <div className="settings-actions">
          <button
            className="btn btn-ghost"
            onClick={handleTest}
            disabled={!draft.trim() || test.status === 'testing'}
          >
            {test.status === 'testing' ? 'Testing…' : 'Test connection'}
          </button>
          <div className="settings-actions-right">
            <button className="btn btn-ghost" onClick={handleClear}>
              Clear
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
