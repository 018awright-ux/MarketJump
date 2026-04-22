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

async function getCompanyNews(ticker: string, from: string, to: string) {
  try {
    const res = await fetch(
      `${FINNHUB_BASE}/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${API_KEY}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

async function getGeneralNews() {
  try {
    const res = await fetch(
      `${FINNHUB_BASE}/news?category=general&token=${API_KEY}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
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

  // Date range for company news (last 7 days)
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().split('T')[0]

  // Fetch in parallel — Next.js deduplicates identical fetch URLs
  const tickersToFetch = watchlistTickers.slice(0, 5)
  const [companyResults, generalNews, cardsRes] = await Promise.all([
    Promise.allSettled(
      tickersToFetch.map(async ticker => {
        const news = await getCompanyNews(ticker, weekAgo, today)
        return { ticker, news: news.slice(0, 3) }
      })
    ),
    getGeneralNews(),
    supabase.from('jump_cards').select('*').order('created_at', { ascending: false }).limit(20),
  ])

  // Flatten company news
  const watchlistNews: Array<{
    ticker: string; headline: string; summary: string
    source: string; url: string; datetime: number
  }> = []

  for (const result of companyResults) {
    if (result.status === 'fulfilled') {
      const { ticker, news } = result.value
      for (const a of news) {
        if (a.headline && a.url) {
          watchlistNews.push({
            ticker, headline: a.headline, summary: a.summary ?? '',
            source: a.source, url: a.url, datetime: a.datetime,
          })
        }
      }
    }
  }
  watchlistNews.sort((a, b) => b.datetime - a.datetime)

  // Filter general news by interest keywords
  const keywords = interests.flatMap(i => INTEREST_KEYWORDS[i] ?? [])
  const filteredGeneral = keywords.length > 0
    ? generalNews
        .filter((a: { headline: string; summary: string }) => {
          const text = ((a.headline ?? '') + ' ' + (a.summary ?? '')).toLowerCase()
          return keywords.some(k => text.includes(k))
        })
        .slice(0, 15)
    : generalNews.slice(0, 15)

  return NextResponse.json({
    watchlistNews: watchlistNews.slice(0, 15),
    generalNews: filteredGeneral,
    cards: cardsRes.data ?? [],
    interests,
    watchlistTickers,
    ts: Date.now(),
  })
}
