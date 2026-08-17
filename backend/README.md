# Vision Board Backend

FastAPI proxy service for the Finnhub-powered Vision Board frontend.

The backend never stores your Finnhub API key. Every request from the frontend
carries the key in an `X-Finnhub-Token` header; the backend forwards it to
Finnhub for that single request only and returns clean, normalized JSON.

## Run

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

## Endpoints

- `GET /api/health` — basic liveness check (no key required)
- `GET /api/verify-key` — validates the supplied Finnhub key
- `GET /api/search?q=` — symbol lookup, works for any ticker Finnhub supports
- `GET /api/quote/{symbol}` — live price, change, %, high/low/prev close
- `GET /api/profile/{symbol}` — company name, logo, industry, market cap
- `GET /api/metrics/{symbol}` — 52-week high/low, P/E, and other metrics
- `GET /api/board/{symbol}` — combined quote + profile + metrics in one call

All endpoints except `/api/health` require the `X-Finnhub-Token` header.
