import { NextResponse } from 'next/server'

const FINNHUB_BASE = 'https://finnhub.io/api/v1'
const API_KEY = process.env.FINNHUB_API_KEY!

// Next.js Data Cache — one fetch per 5 min shared across all instances
export const revalidate = 300

const SECTOR_ETFS = [
  { name: 'S&P 500',     symbol: 'SPY'  },
  { name: 'Nasdaq',      symbol: 'QQQ'  },
  { name: 'Dow Jones',   symbol: 'DIA'  },
  { name: 'Small Cap',   symbol: 'IWM'  },
  { name: 'Tech',        symbol: 'XLK'  },
  { name: 'Energy',      symbol: 'XLE'  },
  { name: 'Healthcare',  symbol: 'XLV'  },
  { name: 'Finance',     symbol: 'XLF'  },
  { name: 'Crypto',      symbol: 'BITO' },
  { name: 'Real Estate', symbol: 'XLRE' },
  { name: 'Consumer',    symbol: 'XLY'  },
  { name: 'Commodities', symbol: 'GLD'  },
]

async function fetchDp(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${FINNHUB_BASE}/quote?symbol=${symbol}&token=${API_KEY}`,
      { next: { revalidate: 300 } }  // CDN cached — same result for all users
    )
    if (!res.ok) return null
    const data = await res.json()
    return typeof data?.dp === 'number' ? data.dp : null
  } catch {
    return null
  }
}

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json({ sectors: [] })
  }

  // Parallel fetches — Next.js deduplicates identical URLs within the same revalidate window
  const results = await Promise.allSettled(
    SECTOR_ETFS.map(async etf => {
      const dp = await fetchDp(etf.symbol)
      return { name: etf.name, symbol: etf.symbol, change: dp, up: (dp ?? 0) >= 0 }
    })
  )

  const sectors = results
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<typeof results[0] extends PromiseFulfilledResult<infer T> ? T : never>).value)

  return NextResponse.json({ sectors, ts: Date.now() })
}
