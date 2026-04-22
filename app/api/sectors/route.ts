import { NextResponse } from 'next/server'
import { getQuote } from '@/lib/finnhub'

const SECTOR_ETFS = [
  { name: 'Tech', symbol: 'XLK' },
  { name: 'Energy', symbol: 'XLE' },
  { name: 'Healthcare', symbol: 'XLV' },
  { name: 'Finance', symbol: 'XLF' },
  { name: 'Crypto', symbol: 'BITO' },
  { name: 'Real Estate', symbol: 'XLRE' },
  { name: 'Consumer', symbol: 'XLY' },
  { name: 'Industrials', symbol: 'XLI' },
  { name: 'Commodities', symbol: 'GLD' },
]

// Cache 60 seconds
let cache: { data: unknown; ts: number } | null = null

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.ts < 60_000) {
    return NextResponse.json(cache.data)
  }

  try {
    const results = await Promise.allSettled(
      SECTOR_ETFS.map(async s => {
        const q = await getQuote(s.symbol)
        return {
          name: s.name,
          symbol: s.symbol,
          change: q?.dp ?? null,
          up: (q?.dp ?? 0) >= 0,
        }
      })
    )

    const sectors = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<{ name: string; symbol: string; change: number | null; up: boolean }>).value)

    const payload = { sectors, ts: now }
    cache = { data: payload, ts: now }
    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ sectors: [], ts: now })
  }
}
