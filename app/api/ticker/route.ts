import { NextResponse } from 'next/server'
import { getQuote } from '@/lib/finnhub'

const SYMBOLS = ['AAPL', 'NVDA', 'TSLA', 'AMZN', 'META', 'MSFT', 'AMD', 'GOOGL', 'JPM', 'SPY', 'QQQ', 'BRK.B']

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Cache 60 seconds — stale values preserved so tape never goes blank
let cache: { data: unknown; ts: number } | null = null

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.ts < 60_000) {
    return NextResponse.json(cache.data)
  }

  try {
    const tickers: { symbol: string; price: number; change: number; changePct: number; up: boolean }[] = []

    // Sequential with 100ms gap — avoids burst rate-limit collisions with /api/sectors
    for (const symbol of SYMBOLS) {
      try {
        const q = await getQuote(symbol)
        if (q?.c) {
          tickers.push({
            symbol,
            price: q.c,
            change: q.d ?? 0,
            changePct: q.dp ?? 0,
            up: (q.dp ?? 0) >= 0,
          })
        }
      } catch { /* skip this symbol */ }
      await sleep(100)
    }

    // Only replace cache if we got meaningful data
    if (tickers.length > 0) {
      const payload = { tickers, ts: now }
      cache = { data: payload, ts: now }
      return NextResponse.json(payload)
    }

    // Return stale cache rather than empty
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json({ tickers: [], ts: now })
  } catch {
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json({ tickers: [], ts: now })
  }
}
