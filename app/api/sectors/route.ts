import { NextResponse } from 'next/server'

const FINNHUB_BASE = 'https://finnhub.io/api/v1'
const API_KEY = process.env.FINNHUB_API_KEY!

const SECTOR_ETFS = [
  { name: 'S&P 500',     symbol: 'SPY'  },
  { name: 'Nasdaq',      symbol: 'QQQ'  },
  { name: 'Tech',        symbol: 'XLK'  },
  { name: 'Energy',      symbol: 'XLE'  },
  { name: 'Healthcare',  symbol: 'XLV'  },
  { name: 'Finance',     symbol: 'XLF'  },
  { name: 'Crypto',      symbol: 'BITO' },
  { name: 'Real Estate', symbol: 'XLRE' },
  { name: 'Consumer',    symbol: 'XLY'  },
  { name: 'Commodities', symbol: 'GLD'  },
  { name: 'Dow Jones',   symbol: 'DIA'  },
  { name: 'Small Cap',   symbol: 'IWM'  },
]

// 5-minute cache — stale values kept so the UI never shows dashes
let cache: { data: SectorPayload; ts: number } | null = null

interface SectorItem {
  name: string
  symbol: string
  change: number | null
  up: boolean
}

interface SectorPayload {
  sectors: SectorItem[]
  ts: number
}

async function fetchQuoteDp(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${FINNHUB_BASE}/quote?symbol=${symbol}&token=${API_KEY}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return null
    const data = await res.json()
    // dp = day percent change; treat 0 as valid data (flat day)
    if (typeof data?.dp === 'number') return data.dp
    return null
  } catch {
    return null
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function GET() {
  const now = Date.now()

  // Return cached data immediately if fresh (5 min)
  if (cache && now - cache.ts < 5 * 60_000) {
    return NextResponse.json(cache.data)
  }

  // Fetch sequentially with 120ms gap to stay well under Finnhub's 60 req/min free limit
  const sectors: SectorItem[] = []
  for (const etf of SECTOR_ETFS) {
    const dp = await fetchQuoteDp(etf.symbol)
    sectors.push({
      name: etf.name,
      symbol: etf.symbol,
      change: dp,
      up: (dp ?? 0) >= 0,
    })
    await sleep(120)
  }

  // Only fully replace cache if we got at least half the data
  const populated = sectors.filter(s => s.change !== null)
  if (populated.length >= Math.floor(SECTOR_ETFS.length / 2)) {
    const payload: SectorPayload = { sectors, ts: now }
    cache = { data: payload, ts: now }
    return NextResponse.json(payload)
  }

  // Partial failure — merge new data over stale cache, keep stale values for failed symbols
  if (cache) {
    const merged = cache.data.sectors.map(old => {
      const fresh = sectors.find(s => s.symbol === old.symbol)
      return (fresh && fresh.change !== null) ? fresh : old
    })
    const payload: SectorPayload = { sectors: merged, ts: now }
    cache = { data: payload, ts: now }
    return NextResponse.json(payload)
  }

  // No cache at all and barely any data — return what we have
  const payload: SectorPayload = { sectors, ts: now }
  cache = { data: payload, ts: now }
  return NextResponse.json(payload)
}
