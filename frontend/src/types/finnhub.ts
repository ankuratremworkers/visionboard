export interface SearchResult {
  symbol: string
  description: string
  type: string
  display_symbol: string
}

export interface SearchResponse {
  count: number
  results: SearchResult[]
}

export interface Quote {
  symbol: string
  current_price: number | null
  change: number | null
  percent_change: number | null
  high: number | null
  low: number | null
  open: number | null
  previous_close: number | null
  timestamp: number | null
}

export interface Profile {
  symbol: string
  name: string | null
  logo: string | null
  industry: string | null
  exchange: string | null
  currency: string | null
  market_capitalization: number | null
  ipo: string | null
  weburl: string | null
}

export interface Metrics {
  symbol: string
  week_52_high: number | null
  week_52_low: number | null
  pe_ttm: number | null
  eps_ttm: number | null
  beta: number | null
  dividend_yield: number | null
  ten_day_avg_volume: number | null
}

export interface BoardSnapshot {
  symbol: string
  quote: Quote
  profile: Profile
  metrics: Metrics
}

export interface KeyStatus {
  valid: boolean
  message: string
}

export interface ApiErrorBody {
  detail: string
}
