import { NextRequest, NextResponse } from 'next/server'
import { getCompanyNews, getMarketNews } from '@/lib/finnhub'
import { createClient } from '@/lib/supabase/server'

// Map interest sectors → search keywords for filtering general news
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
}

// Simple server-side cache per request signature (in-memory, resets on cold start)
const cache = new Map<string, { data: unknown; ts: number }>()

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ news: [], cards: [] })

  const cacheKey = `personalized_${user.id}`
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && now - cached.ts < 5 * 60_000) {
    return NextResponse.json(cached.data)
  }

  // Get profile interests and watchlist in parallel
  const [profileRes, watchlistRes] = await Promise.all([
    supabase.from('profiles').select('interests').eq('id', user.id).single(),
    supabase.from('watchlist').select('ticker').eq('user_id', user.id),
  ])

  const interests: string[] = profileRes.data?.interests ?? []
  const watchlistTickers: string[] = (watchlistRes.data ?? []).map((w: { ticker: string }) => w.ticker)

  // Dates for Finnhub company news (last 7 days)
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const toDate = today.toISOString().split('T')[0]
  const fromDate = weekAgo.toISOString().split('T')[0]

  // Fetch company news for watchlist tickers (up to 5 tickers to avoid rate limits)
  const tickersToFetch = watchlistTickers.slice(0, 5)
  const [companyNewsResults, generalNews, cardsRes] = await Promise.all([
    Promise.allSettled(
      tickersToFetch.map(async ticker => {
        const news = await getCompanyNews(ticker, fromDate, toDate)
        return { ticker, news: (news ?? []).slice(0, 3) }
      })
    ),
    getMarketNews('general'),
    // Get jump_cards matching user's interest sectors
    supabase
      .from('jump_cards')
      .select('*')
      .in('card_type', interests.includes('Macro') ? ['stock', 'social', 'macro'] : ['stock', 'social'])
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  // Flatten company news
  const watchlistNews: Array<{
    ticker: string
    headline: string
    summary: string
    source: string
    url: string
    datetime: number
  }> = []

  for (const result of companyNewsResults) {
    if (result.status === 'fulfilled') {
      const { ticker, news } = result.value
      for (const article of news) {
        watchlistNews.push({
          ticker,
          headline: article.headline,
          summary: article.summary,
          source: article.source,
          url: article.url,
          datetime: article.datetime,
        })
      }
    }
  }

  // Sort watchlist news by date descending
  watchlistNews.sort((a, b) => b.datetime - a.datetime)

  // Filter general news by interests
  const keywords = interests.flatMap(i => INTEREST_KEYWORDS[i] ?? [])
  const filteredGeneral = keywords.length > 0
    ? (generalNews ?? []).filter((a: { headline: string; summary: string }) => {
        const text = (a.headline + ' ' + a.summary).toLowerCase()
        return keywords.some(k => text.includes(k))
      }).slice(0, 10)
    : (generalNews ?? []).slice(0, 10)

  const payload = {
    watchlistNews: watchlistNews.slice(0, 15),
    generalNews: filteredGeneral,
    cards: cardsRes.data ?? [],
    interests,
    watchlistTickers,
  }

  cache.set(cacheKey, { data: payload, ts: now })
  return NextResponse.json(payload)
}
