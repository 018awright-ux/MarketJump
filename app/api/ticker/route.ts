import { NextResponse } from 'next/server'

const FINNHUB_BASE = 'https://finnhub.io/api/v1'
const API_KEY = process.env.FINNHUB_API_KEY!

const SYMBOLS = [
  'AAPL', 'NVDA', 'TSLA', 'AMZN', 'META',
  'MSFT', 'AMD',  'GOOGL', 'JPM',  'SPY',
  'QQQ',  'BRK.B',
]

// Revalidate via Vercel CDN Data Cache — shared across all serverless instances
export const revalidate = 60

async function fetchQuote(symbol: string) {
  try {
    const res = await fetch(
      `${FINNHUB_BASE}/quote?symbol=${symbol}&token=${API_KEY}`,
      { next: { revalidate: 60 } }
    )
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
