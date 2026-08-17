"""Pydantic response models returned to the frontend.

These normalize Finnhub's raw (often cryptically-keyed) JSON into stable,
self-describing shapes so the frontend never has to know about Finnhub's
field naming (c, d, dp, pc, ...).
"""

from __future__ import annotations

from pydantic import BaseModel


class SearchResult(BaseModel):
    symbol: str
    description: str
    type: str
    display_symbol: str


class SearchResponse(BaseModel):
    count: int
    results: list[SearchResult]


class Quote(BaseModel):
    symbol: str
    current_price: float | None = None
    change: float | None = None
    percent_change: float | None = None
    high: float | None = None
    low: float | None = None
    open: float | None = None
    previous_close: float | None = None
    timestamp: int | None = None


class Profile(BaseModel):
    symbol: str
    name: str | None = None
    logo: str | None = None
    industry: str | None = None
    exchange: str | None = None
    currency: str | None = None
    market_capitalization: float | None = None
    ipo: str | None = None
    weburl: str | None = None


class Metrics(BaseModel):
    symbol: str
    week_52_high: float | None = None
    week_52_low: float | None = None
    pe_ttm: float | None = None
    eps_ttm: float | None = None
    beta: float | None = None
    dividend_yield: float | None = None
    ten_day_avg_volume: float | None = None


class BoardSnapshot(BaseModel):
    symbol: str
    quote: Quote
    profile: Profile
    metrics: Metrics


class KeyStatus(BaseModel):
    valid: bool
    message: str
