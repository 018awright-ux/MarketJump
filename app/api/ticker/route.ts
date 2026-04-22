import { NextResponse } from 'next/server'
import { getQuote } from '@/lib/finnhub'

const SYMBOLS = ['AAPL', 'NVDA', 'TSLA', 'AMZN', 'META', 'MSFT', 'AMD', 'GOOGL', 'JPM', 'SPY', 'QQQ', 'BRK.B']

// Cache results for 60 seconds to avoid hammering Finnhub
let cache: { data: unknown; ts: number } | null = null

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.ts < 60_000) {
    return NextResponse.json(cache.data)
  }

  try {
    const results = await Promise.allSettled(
      SYMBOLS.map(async symbol => {
        const q = await getQuote(symbol)
        return {
          symbol,
          price: q?.c ?? null,
          change: q?.d ?? null,
          changePct: q?.dp ?? null,
          up: (q?.dp ?? 0) >= 0,
        }
      })
    )

    const tickers = results
      .filter(r => r.status === 'fulfilled' && r.value.price)
      .map(r => (r as PromiseFulfilledResult<{ symbol: string; price: number; change: number; changePct: number; up: boolean }>).value)

    const payload = { tickers, ts: now }
    cache = { data: payload, ts: now }
    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ tickers: [], ts: now })
  }
}
