# Vision Board — Live Finnhub Metrics

A dark-themed vision board that tracks any ticker you search for and shows
**live, real metrics** pulled from Finnhub: price, day change, day/52-week
high-low, P/E, market cap, and more — auto-refreshing every 20 seconds.

```
backend/    FastAPI + uv — thin proxy to Finnhub, never stores your key
frontend/   React + TypeScript + Vite — dark UI, Settings box, search, board
```

## How the API key works

You paste your Finnhub API key into the app's **Settings** box (gear icon,
top right). It is saved only in your browser's `localStorage` and sent to the
backend as a header (`X-Finnhub-Token`) on every request. The backend uses it
for that single outbound call to Finnhub and discards it — it is never written
to disk, logged, or stored in any config/env file.

## Run it

**1. Backend** (from `backend/`):
```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

**2. Frontend** (from `frontend/`, in a second terminal):
```bash
npm install   # first time only
npm run dev
```

Open the printed URL (default `http://localhost:5173`). The Settings modal
opens automatically on first load — paste your Finnhub API key, hit
**Test connection** to confirm it's live, then **Save**.

## Using the board

- **Search** any ticker in the top search bar (stocks, ETFs, crypto pairs like
  `BINANCE:BTCUSDT` — anything Finnhub's symbol search returns) and click a
  result to add it.
- Each card polls live `/quote`, `/stock/profile2`, and `/stock/metric` data
  every ~20s, with a pulsing "live" indicator and last-updated timestamp.
- Remove a card with the × that appears on hover.
- Your watchlist persists across reloads (stored in `localStorage`).

## Notes

- Finnhub's free tier allows 60 API calls/minute; the 20s poll interval per
  card is tuned to stay well within that for a reasonably sized board.
- If a key is invalid or missing, cards show a clear inline error instead of
  failing silently.

## Run it with Docker

A single multi-stage `Dockerfile` at the repo root builds the frontend and
bundles it into the FastAPI backend, so the whole app is one image on one
port:

```bash
docker build -t vision-board .
docker run -p 8000:8000 vision-board
```

Open `http://localhost:8000` — the Settings modal still lets you paste your
Finnhub key per-browser; the container never sees or stores it beyond
forwarding each request. Same-origin serving means no CORS config is needed
in this mode. If you ever need to serve the frontend from a different origin
than this container, set `EXTRA_CORS_ORIGINS` (comma-separated URLs) as an
env var when running the container.

## Deploying

The image is a standard container — deploy it to any container platform
(a PaaS, a VM with `docker run`, Kubernetes, etc.) by pointing it at this
repo and Dockerfile, exposing port `8000`. No secrets or build args are
required; the Finnhub key is supplied by each visitor at runtime through the
browser UI.