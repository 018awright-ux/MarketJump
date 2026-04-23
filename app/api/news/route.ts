import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

const FINNHUB_BASE = 'https://finnhub.io/api/v1'
const API_KEY = process.env.FINNHUB_API_KEY!

// Company news is on Finnhub free tier — general market news requires premium.
// We pull company news for top movers and merge into a market feed.
const MARKET_TICKERS = ['AAPL', 'NVDA', 'TSLA', 'AMZN', 'META', 'MSFT', 'AMD', 'JPM', 'SPY', 'GOOGL']

type RawArticle = {
  id?: number; headline: string; summary: string
  source: string; url: string; datetime: number
}

async function fetchTickerNews(ticker: string): Promise<Array<RawArticle & { ticker: string }>> {
  const to = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 5 * 86400_000).toISOString().split('T')[0]

  try {
    const res = await fetch(
      `${FINNHUB_BASE}/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${API_KEY}`
    )
    if (!res.ok) {
      console.error(`[news] ${ticker} HTTP ${res.status}`)
      return []
    }
    const data = await res.json()
    if (!Array.isArray(data)) {
      console.error(`[news] ${ticker} non-array response:`, JSON.stringify(data).slice(0, 100))
      return []
    }
    return data.slice(0, 2).map((a: RawArticle) => ({ ...a, ticker }))
  } catch (e) {
    console.error(`[news] ${ticker} fetch error:`, e)
    return []
  }
}

// Cache the full news batch for 5 minutes — shared across all serverless instances
const getCachedNews = unstable_cache(
  async () => {
    const results = await Promise.allSettled(MARKET_TICKERS.map(fetchTickerNews))

    const seen = new Set<string>()
    return results
      .flatMap(r => r.status === 'fulfilled' ? r.value : [])
      .filter(a => {
        if (!a.headline || !a.url) return false
        if (seen.has(a.headline)) return false
        seen.add(a.headline)
        return true
      })
      .sort((a, b) => b.datetime - a.datetime)
      .slice(0, 20)
  },
  ['market-news-v1'],
  { revalidate: 300 }
)

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!API_KEY) return NextResponse.json({ news: [] })

  const news = await getCachedNews()
  return NextResponse.json({ news, ts: Date.now() })
}
