import type {
  ApiErrorBody,
  BoardSnapshot,
  KeyStatus,
  SearchResponse,
} from '../types/finnhub'

export const API_KEY_STORAGE_KEY = 'vision-board:finnhub-api-key'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

export function getStoredApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE_KEY) ?? ''
}

export function setStoredApiKey(key: string): void {
  if (key) {
    localStorage.setItem(API_KEY_STORAGE_KEY, key)
  } else {
    localStorage.removeItem(API_KEY_STORAGE_KEY)
  }
}

async function request<T>(path: string): Promise<T> {
  const apiKey = getStoredApiKey()
  const res = await fetch(path, {
    headers: apiKey ? { 'X-Finnhub-Token': apiKey } : {},
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = (await res.json()) as ApiErrorBody
      detail = body.detail ?? detail
    } catch {
      // response wasn't JSON; keep statusText
    }
    throw new ApiError(res.status, detail)
  }

  return res.json() as Promise<T>
}

export function verifyKey(): Promise<KeyStatus> {
  return request<KeyStatus>('/api/verify-key')
}

export function searchSymbols(query: string): Promise<SearchResponse> {
  return request<SearchResponse>(`/api/search?q=${encodeURIComponent(query)}`)
}

export function getBoardSnapshot(symbol: string): Promise<BoardSnapshot> {
  return request<BoardSnapshot>(`/api/board/${encodeURIComponent(symbol)}`)
}
