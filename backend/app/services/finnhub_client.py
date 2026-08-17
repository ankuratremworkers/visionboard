"""Thin async client around the Finnhub REST API.

The API key is never read from disk, environment, or config — it is passed
in per request (sourced from the frontend's Settings box) and used only for
the lifetime of that single outbound call.
"""

from __future__ import annotations

import httpx
from fastapi import HTTPException

FINNHUB_BASE_URL = "https://finnhub.io/api/v1"


class FinnhubError(HTTPException):
    """Raised for any non-2xx response from Finnhub, mapped to a clean status."""


async def _get(path: str, token: str, params: dict | None = None) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Missing Finnhub API key.")

    query = dict(params or {})
    query["token"] = token

    async with httpx.AsyncClient(base_url=FINNHUB_BASE_URL, timeout=10.0) as client:
        try:
            resp = await client.get(path, params=query)
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502, detail=f"Could not reach Finnhub: {exc}"
            ) from exc

    if resp.status_code == 401 or resp.status_code == 403:
        raise HTTPException(status_code=401, detail="Invalid Finnhub API key.")
    if resp.status_code == 429:
        raise HTTPException(
            status_code=429, detail="Finnhub rate limit exceeded. Slow down polling."
        )
    if resp.status_code >= 400:
        raise HTTPException(
            status_code=resp.status_code, detail=f"Finnhub error: {resp.text}"
        )

    data = resp.json()
    return data


async def search_symbol(query: str, token: str) -> dict:
    return await _get("/search", token, {"q": query})


async def get_quote(symbol: str, token: str) -> dict:
    return await _get("/quote", token, {"symbol": symbol})


async def get_profile(symbol: str, token: str) -> dict:
    return await _get("/stock/profile2", token, {"symbol": symbol})


async def get_metrics(symbol: str, token: str) -> dict:
    return await _get("/stock/metric", token, {"symbol": symbol, "metric": "all"})
