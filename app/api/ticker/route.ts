import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

const FINNHUB_BASE = 'https://finnhub.io/api/v1'
const API_KEY = process.env.FINNHUB_API_KEY!

const SYMBOLS = [
  'AAPL', 'NVDA', 'TSLA', 'AMZN', 'META',
  'MSFT', 'AMD',  'GOOGL', 'JPM',  'SPY',
  'QQQ',  'BRK.B',
]

async function fetchQuote(symbol: string) {
  try {
    const res = await fetch(
      `${FINNHUB_BASE}/quote?symbol=${symbol}&token=${API_KEY}`
    )
    if (!res.ok) return null
    const q = await res.json()
    if (!q?.c) return null

    // Prefer dp from Finnhub; fallback to calculating from c and pc
    let changePct = typeof q.dp === 'number' ? q.dp : null
    if (changePct === null && typeof q.c === 'number' && typeof q.pc === 'number' && q.pc > 0) {
      changePct = ((q.c - q.pc) / q.pc) * 100
    }

    return {
      symbol,
      price: q.c,
      change: q.d ?? (q.c - (q.pc ?? q.c)),
      changePct: changePct ?? 0,
      up: (changePct ?? 0) >= 0,
    }
  } catch {
    return null
  }
}

// Cache the full ticker batch for 60 seconds — shared across all serverless instances
const getCachedTickers = unstable_cache(
  async () => {
    const results = await Promise.allSettled(SYMBOLS.map(s => fetchQuote(s)))
    return results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => (r as PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof fetchQuote>>>>).value)
  },
  ['tickers-v1'],
  { revalidate: 60 }
)

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!API_KEY) return NextResponse.json({ tickers: [] })

  const tickers = await getCachedTickers()
  return NextResponse.json({ tickers, ts: Date.now() })
}
