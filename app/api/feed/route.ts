import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Extended discovery pool — pull news from these tickers to fill gaps
const DISCOVERY_TICKERS = [
  'AAPL','NVDA','TSLA','AMZN','META','MSFT','GOOGL','AMD','JPM','SPY',
  'QQQ','PLTR','NFLX','DIS','BAC','V','MA','UBER','SHOP','COIN',
  'RBLX','SNAP','INTC','ORCL','CRM','PYPL','SQ','RIVN','LCID',
  'F','GM','SOFI','HOOD','DKNG','PENN','MGM','WMT','TGT','COST',
  'GS','MS','WFC','C','USB','PNC','AXP','BX','BLK','SCHW',
]

const FINNHUB_BASE = 'https://finnhub.io/api/v1'
const API_KEY = process.env.FINNHUB_API_KEY

// Fisher-Yates shuffle — truly random each call
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Fetch a news article from Finnhub and format as a lightweight card
async function fetchDiscoveryCards(ticker: string) {
  if (!API_KEY) return []
  try {
    const to = new Date().toISOString().split('T')[0]
    const from = new Date(Date.now() - 3 * 86400_000).toISOString().split('T')[0]
    const res = await fetch(
      `${FINNHUB_BASE}/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${API_KEY}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return []
    const articles = await res.json()
    if (!Array.isArray(articles) || !articles.length) return []

    const article = articles[Math.floor(Math.random() * Math.min(articles.length, 5))]
    if (!article?.headline) return []

    const bull = 50 + Math.floor(Math.random() * 20) - 10
    return [{
      id: `discovery-${ticker}-${article.id ?? article.datetime}`,
      ticker,
      card_type: 'stock',
      source: 'news',
      source_name: article.source ?? 'Market News',
      headline: article.headline,
      summary: article.summary ?? article.headline,
      bull_percent: bull,
      bear_percent: 100 - bull,
      price: null,
      change_percent: null,
      created_at: new Date(article.datetime * 1000).toISOString(),
      is_discovery: true,
    }]
  } catch {
    return []
  }
}

// Fetch a larger batch of discovery cards (for the Discovery filter)
async function fetchManyDiscoveryCards(count = 16) {
  const tickers = shuffle(DISCOVERY_TICKERS).slice(0, count)
  const results = await Promise.allSettled(tickers.map(t => fetchDiscoveryCards(t)))
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const filter = searchParams.get('filter') ?? 'all'

    // Discovery filter — skip DB entirely, return only Finnhub cards
    if (filter === 'discovery') {
      const cards = await fetchManyDiscoveryCards(20)
      return NextResponse.json({ cards: shuffle(cards) })
    }

    const supabase = await createClient()

    // Build the Supabase query based on filter
    let query = supabase.from('jump_cards').select('*')

    if (filter === 'bullish') {
      // Highest bull sentiment first
      query = query.order('bull_percent', { ascending: false }).limit(80)
    } else if (filter === 'bearish') {
      // Lowest bull (= highest bear) first
      query = query.order('bull_percent', { ascending: true }).limit(80)
    } else if (filter === 'trending') {
      // Cards updated in the last 7 days, most recent first
      const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString()
      query = query
        .gte('created_at', weekAgo)
        .order('created_at', { ascending: false })
        .limit(80)
    } else if (filter === 'top_stocks') {
      // Most engaged: extreme sentiment (furthest from 50) signals community activity
      // We sort by bull_percent desc and take top half, giving bullish-leaning "hot" cards
      query = query
        .gte('bull_percent', 55)
        .order('bull_percent', { ascending: false })
        .limit(80)
    } else if (filter === 'commented') {
      // Fall back to recent — a proper count would need an RPC once comments table is live
      query = query.order('created_at', { ascending: false }).limit(80)
    } else {
      // 'all' | 'recent' | any unknown — newest first
      query = query.order('created_at', { ascending: false }).limit(100)
    }

    const { data: cards, error } = await query

    if (error) {
      console.error('Feed error:', error.message)
    }

    // For filters that need pure sorted output, skip the shuffle + discovery injection
    const sortedFilters = ['bullish', 'bearish', 'top_stocks', 'commented', 'trending']
    if (sortedFilters.includes(filter)) {
      return NextResponse.json({ cards: cards ?? [] })
    }

    // Default path: shuffle DB cards + inject discovery
    const dbCards = shuffle(cards ?? [])
    const dbTickers = new Set(dbCards.map((c: { ticker: string }) => c.ticker.toUpperCase()))

    const freshTickers = shuffle(
      DISCOVERY_TICKERS.filter(t => !dbTickers.has(t))
    ).slice(0, 8)

    const discoveryResults = await Promise.allSettled(
      freshTickers.map(t => fetchDiscoveryCards(t))
    )
    const discoveryCards = discoveryResults
      .flatMap(r => r.status === 'fulfilled' ? r.value : [])

    // Interleave: every 3 DB cards, inject 1 discovery card
    const merged = []
    let di = 0
    for (let i = 0; i < dbCards.length; i++) {
      merged.push(dbCards[i])
      if ((i + 1) % 3 === 0 && di < discoveryCards.length) {
        merged.push(discoveryCards[di++])
      }
    }
    while (di < discoveryCards.length) merged.push(discoveryCards[di++])

    const final = merged.length ? merged : discoveryCards

    return NextResponse.json({ cards: final })
  } catch (err) {
    console.error('Feed route error:', err)
    return NextResponse.json({ cards: [] })
  }
}
