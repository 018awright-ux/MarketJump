import { NextResponse } from 'next/server'
import { cacheLife } from 'next/cache'

const FINNHUB_BASE = 'https://finnhub.io/api/v1'
const API_KEY = process.env.FINNHUB_API_KEY!

const SYMBOLS = [
  'AAPL', 'NVDA', 'TSLA', 'AMZN', 'META',
  'MSFT', 'AMD',  'GOOGL', 'JPM',  'SPY',
  'QQQ',  'BRK.B',
]

// Cached per-symbol — shared across all serverless instances
// Revalidates every 60 seconds
async function fetchQuote(symbol: string) {
  'use cache'
  cacheLife({ revalidate: 60, stale: 60, expire: 300 })
  try {
    const res = await fetch(`${FINNHUB_BASE}/quote?symbol=${symbol}&token=${API_KEY}`)
    if (!res.ok) return null
    const q = await res.json()
    if (!q?.c) return null
    return {
      symbol,
      price: q.c,
      change: q.d ?? 0,
      changePct: q.dp ?? 0,
      up: (q.dp ?? 0) >= 0,
    }
  } catch {
    return null
  }
}

export async function GET() {
  if (!API_KEY) return NextResponse.json({ tickers: [] })

  const results = await Promise.allSettled(SYMBOLS.map(s => fetchQuote(s)))

  const tickers = results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof fetchQuote>>>>).value)

  return NextResponse.json({ tickers, ts: Date.now() })
}
