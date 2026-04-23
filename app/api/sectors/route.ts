import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

const FINNHUB_BASE = 'https://finnhub.io/api/v1'
const API_KEY = process.env.FINNHUB_API_KEY!

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

async function fetchQuoteChange(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `${FINNHUB_BASE}/quote?symbol=${symbol}&token=${API_KEY}`
    )
    if (!res.ok) {
      console.error(`[sectors] ${symbol} HTTP ${res.status}`)
      return null
    }
    const data = await res.json()

    // Prefer dp (percent change) from Finnhub
    if (typeof data?.dp === 'number' && data.dp !== 0) return data.dp

    // Fallback: calculate from current price and previous close
    // Finnhub always returns c and pc even when dp is null
    if (typeof data?.c === 'number' && typeof data?.pc === 'number' && data.pc > 0) {
      return ((data.c - data.pc) / data.pc) * 100
    }

    console.error(`[sectors] ${symbol} no usable data:`, JSON.stringify(data))
    return null
  } catch (e) {
    console.error(`[sectors] ${symbol} fetch error:`, e)
    return null
  }
}

// Cache the full sector batch for 5 minutes — shared across all serverless instances
const getCachedSectors = unstable_cache(
  async () => {
    const results = await Promise.allSettled(
      SECTOR_ETFS.map(async etf => {
        const change = await fetchQuoteChange(etf.symbol)
        return { name: etf.name, symbol: etf.symbol, change, up: (change ?? 0) >= 0 }
      })
    )
    return results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<{ name: string; symbol: string; change: number | null; up: boolean }>).value)
  },
  ['sectors-v1'],
  { revalidate: 300 }
)

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!API_KEY) return NextResponse.json({ sectors: [] })

  const sectors = await getCachedSectors()
  return NextResponse.json({ sectors, ts: Date.now() })
}
