import { NextResponse } from 'next/server'

const FINNHUB_BASE = 'https://finnhub.io/api/v1'
const API_KEY = process.env.FINNHUB_API_KEY!

// Company news IS on Finnhub free tier — general news requires premium
// We pull company news for the top movers and merge it into a market feed
const MARKET_TICKERS = ['AAPL', 'NVDA', 'TSLA', 'AMZN', 'META', 'MSFT', 'AMD', 'JPM', 'SPY', 'GOOGL']

type RawArticle = {
  id?: number; headline: string; summary: string
  source: string; url: string; datetime: number
}

// Revalidate via Vercel CDN Data Cache — shared across all serverless instances
export const revalidate = 300

async function fetchTickerNews(ticker: string): Promise<Array<RawArticle & { ticker: string }>> {
  const to = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 5 * 86400_000).toISOString().split('T')[0]

  try {
    const res = await fetch(
      `${FINNHUB_BASE}/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${API_KEY}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.slice(0, 2).map((a: RawArticle) => ({ ...a, ticker }))
  } catch {
    return []
  }
}

export async function GET() {
  if (!API_KEY) return NextResponse.json({ news: [] })

  const results = await Promise.allSettled(MARKET_TICKERS.map(fetchTickerNews))

  // Flatten, deduplicate by headline, sort newest first
  const seen = new Set<string>()
  const news = results
    .flatMap(r => r.status === 'fulfilled' ? r.value : [])
    .filter(a => {
      if (!a.headline || !a.url) return false
      if (seen.has(a.headline)) return false
      seen.add(a.headline)
      return true
    })
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, 20)

  return NextResponse.json({ news, ts: Date.now() })
}
