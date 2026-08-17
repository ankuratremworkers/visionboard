from __future__ import annotations

import asyncio

from fastapi import APIRouter, Header, HTTPException, Query

from app.schemas import (
    BoardSnapshot,
    KeyStatus,
    Metrics,
    Profile,
    Quote,
    SearchResponse,
    SearchResult,
)
from app.services import finnhub_client as fh

router = APIRouter(prefix="/api", tags=["finnhub"])


def _require_token(x_finnhub_token: str | None) -> str:
    if not x_finnhub_token:
        raise HTTPException(
            status_code=401,
            detail="Missing X-Finnhub-Token header. Set your API key in Settings.",
        )
    return x_finnhub_token


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.get("/verify-key", response_model=KeyStatus)
async def verify_key(x_finnhub_token: str | None = Header(default=None)) -> KeyStatus:
    token = _require_token(x_finnhub_token)
    try:
        await fh.get_quote("AAPL", token)
    except HTTPException as exc:
        if exc.status_code == 401:
            return KeyStatus(valid=False, message="Invalid API key.")
        raise
    return KeyStatus(valid=True, message="API key is valid and working.")


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(min_length=1),
    x_finnhub_token: str | None = Header(default=None),
) -> SearchResponse:
    token = _require_token(x_finnhub_token)
    data = await fh.search_symbol(q, token)
    results = [
        SearchResult(
            symbol=item.get("symbol", ""),
            description=item.get("description", ""),
            type=item.get("type", ""),
            display_symbol=item.get("displaySymbol", item.get("symbol", "")),
        )
        for item in data.get("result", [])
    ]
    return SearchResponse(count=len(results), results=results)


def _to_quote(symbol: str, raw: dict) -> Quote:
    return Quote(
        symbol=symbol,
        current_price=raw.get("c"),
        change=raw.get("d"),
        percent_change=raw.get("dp"),
        high=raw.get("h"),
        low=raw.get("l"),
        open=raw.get("o"),
        previous_close=raw.get("pc"),
        timestamp=raw.get("t"),
    )


def _to_profile(symbol: str, raw: dict) -> Profile:
    return Profile(
        symbol=symbol,
        name=raw.get("name"),
        logo=raw.get("logo"),
        industry=raw.get("finnhubIndustry"),
        exchange=raw.get("exchange"),
        currency=raw.get("currency"),
        market_capitalization=raw.get("marketCapitalization"),
        ipo=raw.get("ipo"),
        weburl=raw.get("weburl"),
    )


def _to_metrics(symbol: str, raw: dict) -> Metrics:
    m = raw.get("metric", {}) or {}
    return Metrics(
        symbol=symbol,
        week_52_high=m.get("52WeekHigh"),
        week_52_low=m.get("52WeekLow"),
        pe_ttm=m.get("peTTM"),
        eps_ttm=m.get("epsTTM"),
        beta=m.get("beta"),
        dividend_yield=m.get("dividendYieldIndicatedAnnual"),
        ten_day_avg_volume=m.get("10DayAverageTradingVolume"),
    )


@router.get("/quote/{symbol}", response_model=Quote)
async def quote(
    symbol: str, x_finnhub_token: str | None = Header(default=None)
) -> Quote:
    token = _require_token(x_finnhub_token)
    raw = await fh.get_quote(symbol, token)
    if raw.get("c") in (None, 0) and raw.get("pc") in (None, 0):
        raise HTTPException(status_code=404, detail=f"No quote data for '{symbol}'.")
    return _to_quote(symbol.upper(), raw)


@router.get("/profile/{symbol}", response_model=Profile)
async def profile(
    symbol: str, x_finnhub_token: str | None = Header(default=None)
) -> Profile:
    token = _require_token(x_finnhub_token)
    raw = await fh.get_profile(symbol, token)
    if not raw:
        raise HTTPException(status_code=404, detail=f"No profile data for '{symbol}'.")
    return _to_profile(symbol.upper(), raw)


@router.get("/metrics/{symbol}", response_model=Metrics)
async def metrics(
    symbol: str, x_finnhub_token: str | None = Header(default=None)
) -> Metrics:
    token = _require_token(x_finnhub_token)
    raw = await fh.get_metrics(symbol, token)
    return _to_metrics(symbol.upper(), raw)


@router.get("/board/{symbol}", response_model=BoardSnapshot)
async def board_snapshot(
    symbol: str, x_finnhub_token: str | None = Header(default=None)
) -> BoardSnapshot:
    token = _require_token(x_finnhub_token)
    quote_raw, profile_raw, metrics_raw = await asyncio.gather(
        fh.get_quote(symbol, token),
        fh.get_profile(symbol, token),
        fh.get_metrics(symbol, token),
    )
    if quote_raw.get("c") in (None, 0) and quote_raw.get("pc") in (None, 0):
        raise HTTPException(status_code=404, detail=f"No data for '{symbol}'.")

    sym = symbol.upper()
    return BoardSnapshot(
        symbol=sym,
        quote=_to_quote(sym, quote_raw),
        profile=_to_profile(sym, profile_raw),
        metrics=_to_metrics(sym, metrics_raw),
    )
