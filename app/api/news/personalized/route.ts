import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FINNHUB_BASE = 'https://finnhub.io/api/v1'
const API_KEY = process.env.FINNHUB_API_KEY!

const INTEREST_KEYWORDS: Record<string, string[]> = {
  Tech: ['apple', 'nvidia', 'microsoft', 'google', 'meta', 'ai', 'semiconductor', 'software', 'chip', 'tech'],
  Energy: ['oil', 'gas', 'opec', 'energy', 'exxon', 'chevron', 'brent', 'crude', 'renewable'],
  Healthcare: ['fda', 'drug', 'pharma', 'health', 'biotech', 'vaccine', 'medical', 'clinical'],
  Finance: ['fed', 'bank', 'rate', 'interest', 'jpmorgan', 'goldman', 'inflation', 'treasury', 'bond'],
  Crypto: ['bitcoin', 'ethereum', 'crypto', 'blockchain', 'btc', 'eth', 'defi', 'nft'],
  Commodities: ['gold', 'silver', 'copper', 'wheat', 'commodity', 'futures', 'metals'],
  'Real Estate': ['reit', 'real estate', 'housing', 'mortgage', 'property'],
  Macro: ['fed', 'cpi', 'gdp', 'inflation', 'recession', 'employment', 'jobs', 'tariff', 'trade'],
  Options: ['options', 'calls', 'puts', 'volatility', 'vix', 'derivatives'],
  'Index Funds': ['s&p 500', 'spy', 'qqq', 'dow jones', 'nasdaq', 'index fund', 'etf', 'iwm', 'vti', 'russell'],
}

// Same 10 tickers as /api/news
const MARKET_TICKERS = ['AAPL', 'NVDA', 'TSLA', 'AMZN', 'META', 'MSFT', 'AMD', 'JPM', 'SPY', 'GOOGL']

type NewsArticle = {
  headline: string; summary: string; source: string
  url: string; datetime: number; ticker?: string
}

// Must be dynamic — uses cookie-based auth (createClient reads cookies)
export const dynamic = 'force-dynamic'

async function fetchTickerNews(ticker: string): Promise<NewsArticle[]> {
  const to = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 7 * 86400_000).toISOString().split('T')[0]

  try {
    const res = await fetch(
      `${FINNHUB_BASE}/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${API_KEY}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.slice(0, 3).map((a: NewsArticle) => ({ ...a, ticker }))
  } catch {
    return []
  }
}

async function fetchWatchlistNews(ticker: string): Promise<NewsArticle[]> {
  const to = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 7 * 86400_000).toISOString().split('T')[0]

  try {
    const res = await fetch(
      `${FINNHUB_BASE}/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${API_KEY}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.slice(0, 3).map((a: NewsArticle) => ({ ...a, ticker }))
  } catch {
    return []
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ news: [], cards: [], interests: [], watchlistTickers: [] })

  // Get profile interests and watchlist in parallel
  const [profileRes, watchlistRes] = await Promise.all([
    supabase.from('profiles').select('interests').eq('id', user.id).single(),
    supabase.from('watchlist').select('ticker').eq('user_id', user.id),
  ])

  const interests: string[] = profileRes.data?.interests ?? []
  const watchlistTickers: string[] = (watchlistRes.data ?? []).map((w: { ticker: string }) => w.ticker)

  const tickersToFetch = watchlistTickers.slice(0, 5)

  // Fetch in parallel — all calls use Vercel CDN Data Cache via { next: { revalidate } }
  const [watchlistResults, marketResults, cardsRes] = await Promise.all([
    Promise.allSettled(tickersToFetch.map(fetchWatchlistNews)),
    Promise.allSettled(MARKET_TICKERS.map(fetchTickerNews)),
    supabase.from('jump_cards').select('*').order('created_at', { ascending: false }).limit(20),
  ])

  // Flatten watchlist news
  const seen = new Set<string>()
  const watchlistNews: NewsArticle[] = []
  for (const result of watchlistResults) {
    if (result.status === 'fulfilled') {
      for (const a of result.value) {
        if (a.headline && a.url && !seen.has(a.headline)) {
          seen.add(a.headline)
          watchlistNews.push(a)
        }
      }
    }
  }
  watchlistNews.sort((a, b) => b.datetime - a.datetime)

  // Flatten market news
  const marketSeen = new Set<string>()
  const broadNews: NewsArticle[] = []
  for (const result of marketResults) {
    if (result.status === 'fulfilled') {
      for (const a of result.value) {
        if (a.headline && a.url && !marketSeen.has(a.headline)) {
          marketSeen.add(a.headline)
          broadNews.push(a)
        }
      }
    }
  }
  broadNews.sort((a, b) => b.datetime - a.datetime)

  // Filter by interest keywords (or show all if no interests)
  const keywords = interests.flatMap(i => INTEREST_KEYWORDS[i] ?? [])
  const filteredGeneral = keywords.length > 0
    ? broadNews
        .filter(a => {
          const text = ((a.headline ?? '') + ' ' + (a.summary ?? '')).toLowerCase()
          return keywords.some(k => text.includes(k))
        })
        .slice(0, 15)
    : broadNews.slice(0, 15)

  return NextResponse.json({
    watchlistNews: watchlistNews.slice(0, 15),
    generalNews: filteredGeneral,
    cards: cardsRes.data ?? [],
    interests,
    watchlistTickers,
    ts: Date.now(),
  })
}
