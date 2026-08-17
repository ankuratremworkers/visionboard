# Vision Board — How It Works

This document explains the complete functioning of the app: the architecture,
every request path, every file's role, the data flow from Finnhub to the
screen, and the security model around the API key.

---

## 1. High-level architecture

```
+-------------------------+        +--------------------------+        +-------------+
|   Browser (React app)   |  HTTP  |   FastAPI backend (uv)   |  HTTP  |   Finnhub   |
|  localhost:5173 (dev)   | -----> |   localhost:8000         | -----> |   REST API  |
|                         | <----- |                          | <----- |             |
+-------------------------+        +--------------------------+        +-------------+
     |
     +- API key lives ONLY in localStorage here.
        Sent as header `X-Finnhub-Token` on every request.
        Backend never writes it to disk/env/logs — used once, per call, then discarded.
```

Two independent processes, no shared code:

- **`backend/`** — Python 3.11+, managed by `uv`, FastAPI app. Its only job is
  to call Finnhub on behalf of the browser and reshape the response into
  clean, typed JSON. It holds **no state** — no database, no session, no
  stored key.
- **`frontend/`** — React 19 + TypeScript + Vite. Owns all persistent state
  (the API key, the watchlist) in the browser via `localStorage`. Polls the
  backend on an interval per card to keep numbers live.

In development, Vite's dev server proxies `/api/*` to `http://127.0.0.1:8000`
(see `frontend/vite.config.ts`), so the browser only ever talks to one origin
(`localhost:5173`) and never needs to know the backend's real port —
avoiding CORS entirely in dev. The backend also has CORS middleware enabled
for `localhost:5173` / `127.0.0.1:5173` as a second line of defense (e.g. if
you hit the backend directly during development or testing).

---

## 2. The API key — exactly what happens to it

This is the most important design constraint in the app, so it's covered in
full detail:

1. **Entry point**: the user pastes their key into the Settings modal
   (`SettingsModal.tsx`), an input of `type="password"` with `autoComplete="off"`.
2. **Storage**: `setStoredApiKey()` (in `api/client.ts`) writes it to
   `localStorage` under the key `vision-board:finnhub-api-key`. That's the
   *only* place it's persisted — no cookies, no backend database, no `.env`
   file.
3. **Every outbound request** from the frontend goes through the single
   `request<T>()` helper in `client.ts`, which reads the key fresh from
   `localStorage` and attaches it as an `X-Finnhub-Token` header:
   ```ts
   const res = await fetch(path, {
     headers: apiKey ? { 'X-Finnhub-Token': apiKey } : {},
   })
   ```
4. **Backend receives it per-request only.** Every route handler in
   `app/routers/finnhub.py` takes `x_finnhub_token: str | None = Header(default=None)`
   as a FastAPI dependency-injected parameter — it exists purely in that
   request's memory/stack frame. `_require_token()` rejects the call with
   `401` if it's missing.
5. **Backend forwards it to Finnhub** as a query parameter (`?token=...`,
   which is how Finnhub's REST API expects it) inside
   `app/services/finnhub_client.py`'s `_get()` function, over a fresh
   `httpx.AsyncClient` instance per request. The token is never logged,
   never written to a variable that outlives the request, and never touches
   disk.
6. **"Test connection"** in Settings calls `GET /api/verify-key`, which makes
   one real `GET /quote?symbol=AAPL` call to Finnhub using the *draft* key
   just typed (saved to `localStorage` first so the header can be attached)
   and reports back whether Finnhub accepted it (`401` → invalid key, `200`
   → valid). This is real validation against the live API, not a format check.
7. **Clearing the key**: the Settings modal's "Clear" button wipes
   `localStorage` and blanks the app's in-memory `apiKey` state immediately.

Net effect: **at no point does the backend process ever persist the key.**
Restarting the backend, inspecting its filesystem, or checking its process
environment reveals nothing about any key that's been used through it.

---

## 3. Backend — file by file

### `pyproject.toml`
Managed by `uv`. Runtime deps: `fastapi`, `uvicorn[standard]`, `httpx`,
`pydantic`. Requires Python `>=3.11`.

### `app/main.py`
Creates the `FastAPI` app, attaches `CORSMiddleware` (GET only, allows the
`X-Finnhub-Token` and `Content-Type` headers, restricted to the Vite dev
origins), mounts the router from `app/routers/finnhub.py`, and defines:
- `GET /` → `{"service": "vision-board-backend", "docs": "/docs"}` (a
  friendly root, and a pointer to FastAPI's auto-generated Swagger docs at
  `/docs`).

### `app/schemas.py`
Pydantic response models. These exist specifically to **normalize Finnhub's
cryptic field names** (`c`, `d`, `dp`, `pc`, `finnhubIndustry`, `peTTM`, ...)
into stable, self-documenting shapes the frontend can rely on without ever
touching Finnhub's raw JSON:

| Model | Purpose | Key fields |
|---|---|---|
| `SearchResult` / `SearchResponse` | Symbol search results | `symbol`, `description`, `type`, `display_symbol` |
| `Quote` | Live price snapshot | `current_price`, `change`, `percent_change`, `high`, `low`, `open`, `previous_close`, `timestamp` |
| `Profile` | Company/instrument metadata | `name`, `logo`, `industry`, `exchange`, `currency`, `market_capitalization`, `ipo`, `weburl` |
| `Metrics` | Fundamentals | `week_52_high`, `week_52_low`, `pe_ttm`, `eps_ttm`, `beta`, `dividend_yield`, `ten_day_avg_volume` |
| `BoardSnapshot` | One bundle per symbol | `quote` + `profile` + `metrics` combined |
| `KeyStatus` | Result of key verification | `valid: bool`, `message: str` |

### `app/services/finnhub_client.py`
The only file that talks to Finnhub. `FINNHUB_BASE_URL = "https://finnhub.io/api/v1"`.

- `_get(path, token, params)` — core primitive. Builds a fresh
  `httpx.AsyncClient`, attaches `token` as a query param, and maps Finnhub's
  HTTP responses to clean errors:
  - `401`/`403` from Finnhub → `HTTPException(401, "Invalid Finnhub API key.")`
  - `429` → `HTTPException(429, "Finnhub rate limit exceeded. Slow down polling.")`
  - other `4xx/5xx` → passthrough with Finnhub's error text
  - network failure (`httpx.RequestError`) → `HTTPException(502, "Could not reach Finnhub: ...")`
- `search_symbol(query, token)` → `GET /search?q=`
- `get_quote(symbol, token)` → `GET /quote?symbol=`
- `get_profile(symbol, token)` → `GET /stock/profile2?symbol=`
- `get_metrics(symbol, token)` → `GET /stock/metric?symbol=&metric=all`

### `app/routers/finnhub.py`
`APIRouter(prefix="/api")`. `_require_token()` is the shared 401 guard used
by every route that needs the key.

| Route | What it does |
|---|---|
| `GET /api/health` | Liveness check, no key required — `{"status": "ok"}` |
| `GET /api/verify-key` | Calls `get_quote("AAPL", token)`; returns `KeyStatus(valid, message)`. `401` from Finnhub → `valid=false`, anything else propagates as a real error |
| `GET /api/search?q=` | Calls `search_symbol`, maps Finnhub's raw `result[]` array into `SearchResult[]` |
| `GET /api/quote/{symbol}` | Calls `get_quote`, maps to `Quote`. Treats an all-zero/null response (`c` and `pc` both empty) as `404 No quote data` — Finnhub returns `200` with zeros for unknown symbols rather than a real 404, so this check catches that |
| `GET /api/profile/{symbol}` | Calls `get_profile`, maps to `Profile`. Empty dict → `404` |
| `GET /api/metrics/{symbol}` | Calls `get_metrics`, maps `raw["metric"]` sub-object to `Metrics` |
| `GET /api/board/{symbol}` | **The one the frontend actually polls.** Uses `asyncio.gather()` to fire quote+profile+metrics **concurrently** (one round-trip's worth of wall-clock time instead of three sequential ones), applies the same not-found check as `/quote`, and returns a single `BoardSnapshot` |

All symbol-scoped routes uppercase the symbol in the response
(`symbol.upper()`) regardless of how it was cased in the request.

---

## 4. Frontend — file by file

### `vite.config.ts`
Dev-only proxy: any request to `/api/*` from the React app is forwarded to
`http://127.0.0.1:8000` with `changeOrigin: true`. This is why the frontend's
code never hardcodes a backend URL — it just calls `fetch('/api/...')` and
Vite handles routing it correctly in dev. (For a production build, this
proxy would need to be replaced by a real reverse-proxy rule or the backend's
public URL — see §7 below.)

### `src/types/finnhub.ts`
TypeScript mirrors of the backend's Pydantic models (`SearchResult`,
`SearchResponse`, `Quote`, `Profile`, `Metrics`, `BoardSnapshot`, `KeyStatus`),
plus `ApiErrorBody` (`{ detail: string }`, matching FastAPI's default error
shape) so `client.ts` can type-check error responses too.

### `src/types/watchlist.ts`
`WatchlistItem { symbol: string; description?: string }` — the shape stored
per card in the user's board (separate from the live data, which is fetched
on demand).

### `src/api/client.ts`
The single gateway between React and the backend.
- `API_KEY_STORAGE_KEY = 'vision-board:finnhub-api-key'`
- `getStoredApiKey()` / `setStoredApiKey()` — thin `localStorage` wrappers
- `ApiError` — custom `Error` subclass carrying the HTTP `status`, thrown by
  `request<T>()` whenever a response isn't `ok`, with the message taken from
  FastAPI's `{"detail": "..."}` body when present
- `request<T>(path)` — attaches the header, fetches, throws or parses JSON
- `verifyKey()`, `searchSymbols(query)`, `getBoardSnapshot(symbol)` — the
  three calls the rest of the app actually uses

### `src/hooks/useLocalStorage.ts`
Generic `useState`-like hook that reads its initial value from
`localStorage` (falling back silently to `initialValue` on any parse error)
and writes back on every change (silently ignoring quota errors — the app
keeps working in-memory even if storage is full/unavailable). Used for both
the API key mirror in `App.tsx` state and the persisted `watchlist` array.

### `src/hooks/useBoardSnapshot.ts`
The polling engine behind every card.
- `POLL_INTERVAL_MS = 20_000` (20 seconds)
- On mount (and whenever `symbol` or `hasApiKey` changes): fetches once
  immediately, then sets a `setInterval` to repeat every 20s
- Tracks `{ data, error, loading, lastUpdated }`; `lastUpdated` is a
  `Date.now()` timestamp used to render "Xs ago" / "Xm ago" on the card
- If `hasApiKey` is false, short-circuits to an error state without ever
  calling the network
- Cleans up its interval and guards against setting state after unmount
  (`cancelled` flag) — no memory leaks or stale updates across re-renders

### `src/components/SettingsModal.tsx`
- Local `draft` state seeded from the currently-saved key
- **Test connection**: saves the draft to `localStorage` immediately (so the
  header is available), calls `verifyKey()`, shows a green check or red cross
  status line with Finnhub's real response message
- **Save**: trims, persists, calls `onSave(key)` to update `App`'s state,
  closes the modal
- **Clear**: wipes the key everywhere (draft, storage, app state) and resets
  the test status
- Modal auto-opens on first load if no key is stored yet (`App.tsx` sets
  `settingsOpen` initial state to `!apiKey`)

### `src/components/TickerSearch.tsx`
- Debounced (350ms) search-as-you-type against `GET /api/search`
- Shows up to 12 results in a dropdown with symbol + description
- Handles the "no key set" case with an inline message instead of attempting
  a call that would just 401
- Click-outside detection closes the dropdown (`mousedown` listener on
  `document`, checked against a `containerRef`)
- Selecting a result calls `onAdd(symbol, description)` (from `App.tsx`) and
  resets the input

### `src/components/TickerCard.tsx`
- Calls `useBoardSnapshot(symbol, hasApiKey)` — one independent polling loop
  per card, so cards refresh on their own schedule and one slow/failing
  symbol never blocks another
- Renders, while `data` is present:
  - Logo (falls back to a two-letter placeholder built from the symbol)
  - Company name (falls back to the search-result description, then `—`)
  - Price + change, colored green (`.positive`) or red (`.negative`) with an
    up/down arrow, based on `quote.change >= 0`
  - An 8-cell metric grid: Open, Prev Close, Day High/Low, 52-Week High/Low,
    P/E (TTM), Market Cap
  - `formatMarketCap()` converts Finnhub's raw "millions" figure into
    `$X.XXT` / `$X.XXB` / `$XM` for readability
  - A footer with the industry tag and a live pulsing dot + "Xs/Xm ago"
    freshness indicator (`timeAgo()`)
- Shows a loading state on first fetch, and an inline error banner
  (Finnhub's real error message, e.g. invalid key / rate limit / bad symbol)
  if the fetch fails
- A remove (×) button, visible on hover, calls `onRemove(symbol)`

### `src/components/VisionBoard.tsx`
Pure layout component: renders an empty-state message when the watchlist is
empty, otherwise a responsive CSS grid (`auto-fill, minmax(280px, 1fr)`) of
`TickerCard`s, one per watchlist item.

### `src/App.tsx`
Ties everything together:
- `apiKey` — `useState` seeded from `getStoredApiKey()`
- `settingsOpen` — starts `true` if no key is present yet
- `watchlist` — `useLocalStorage('vision-board:watchlist', [])`, so the
  board survives page reloads
- `handleAdd` — dedupes by symbol before appending
- `handleRemove` — filters the symbol out
- Header: brand mark, `TickerSearch` (centered), a live/no-key badge, and a
  gear button that opens `SettingsModal`
- Renders `VisionBoard` in `<main>`

### `src/styles/theme.css`
Dark theme via CSS custom properties — `--bg`, `--bg-elevated`, `--bg-card`,
`--border`, `--border-hover`, `--text`, `--text-dim`, `--text-faint`,
`--accent` (blue), `--green`/`--red` (for gains/losses), `--radius`, plus a
`--green-soft` tint used by the key-status badge. Every component's CSS
references these variables rather than hardcoding colors, so the whole app's
palette can be changed from this one file. `src/index.css` holds only a
box-sizing reset and the `#root` flex layout — it deliberately carries no
color of its own so it can't fight with the theme.

---

## 5. A complete request, start to finish

**Scenario: user searches "AAPL" and adds it to the board.**

1. User types `AAPL` into `TickerSearch`. After 350ms of no further typing,
   it calls `searchSymbols('AAPL')`.
2. `client.ts` builds `fetch('/api/search?q=AAPL', { headers: { 'X-Finnhub-Token': <key> } })`.
3. Vite's dev proxy forwards this to `http://127.0.0.1:8000/api/search?q=AAPL`
   (same headers, same query).
4. FastAPI's `search()` handler pulls the token off the header, calls
   `fh.search_symbol('AAPL', token)`.
5. `finnhub_client.py` calls `https://finnhub.io/api/v1/search?q=AAPL&token=<key>`.
6. Finnhub responds with raw JSON (`{"count": N, "result": [{...}, ...]}`).
7. The router maps each raw result into a `SearchResult` and returns
   `SearchResponse` as clean JSON.
8. `TickerSearch` renders up to 12 results in the dropdown.
9. User clicks the `AAPL` result → `handleSelect` calls `onAdd('AAPL', 'Apple Inc')`.
10. `App.tsx`'s `handleAdd` appends `{ symbol: 'AAPL', description: 'Apple Inc' }`
    to `watchlist` (deduped), which `useLocalStorage` immediately persists.
11. `VisionBoard` re-renders with a new `TickerCard` for `AAPL`, which mounts
    `useBoardSnapshot('AAPL', true)`.
12. That hook immediately calls `GET /api/board/AAPL` → the backend fires
    quote + profile + metrics concurrently via `asyncio.gather`, bundles them
    into one `BoardSnapshot`, and returns it in a single round trip.
13. The card renders price, change, and all 8 metrics. Every 20 seconds,
    the hook repeats step 12 automatically for as long as the card is mounted.
14. If the user removes the card, `useBoardSnapshot`'s cleanup clears its
    interval — no orphaned polling.

---

## 6. Error handling & edge cases already covered

- **No key set** → search and cards short-circuit locally with a clear
  message, never firing a request that would just fail.
- **Invalid key** → Finnhub's `401/403` becomes a uniform `401` from the
  backend with `"Invalid Finnhub API key."`, surfaced verbatim in the UI
  (Settings test button and card error banners both show it).
- **Rate limit** → Finnhub's `429` is passed through with a specific
  "slow down polling" message rather than a generic failure.
- **Unknown/garbage symbol** → Finnhub returns `200` with an all-null/zero
  body for quotes; the backend detects that and turns it into a real `404`
  instead of silently rendering a blank card.
- **Network failure reaching Finnhub** → mapped to `502` with the underlying
  `httpx` error message, distinguishing "we're up but Finnhub isn't
  reachable" from other failure modes.
- **Storage quota/unavailable** → `useLocalStorage` swallows write errors so
  the app keeps functioning in-memory rather than crashing.
- **Component unmount mid-request** → `useBoardSnapshot`'s `cancelled` flag
  prevents state updates after a card is removed.

---

## 7. Known limitations / things to know before extending

- **Dev-only proxy**: the `/api` → `127.0.0.1:8000` rewrite in
  `vite.config.ts` only applies to `npm run dev`. A production static build
  (`npm run build`) would need either a reverse proxy (nginx, Caddy) in front
  of both services, or the frontend calling an absolute backend URL.
- **No rate-limit backoff**: each card polls every 20s regardless of how
  many cards are open; with Finnhub's free-tier 60 calls/min limit, roughly
  6-7 cards (each making 1 combined `/board` call, i.e. 3 Finnhub calls
  under the hood) is the practical ceiling before hitting `429`s. Reducing
  poll frequency or batching would be the next improvement if you add many
  tickers.
- **No auth on the backend itself**: anyone who can reach `localhost:8000`
  can call it with their own `X-Finnhub-Token` header — this is fine for a
  local single-user tool but would need real auth before exposing it beyond
  localhost.
- **CORS is currently locked to the Vite dev origins** (`localhost:5173` /
  `127.0.0.1:5173`) in `app/main.py`; deploying the frontend elsewhere means
  adding that origin to `allow_origins`.