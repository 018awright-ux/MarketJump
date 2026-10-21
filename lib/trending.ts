import type { SupabaseClient } from '@supabase/supabase-js'

// Shown (in this order) to fill the list when there isn't enough discussion yet
export const FALLBACK_TRENDING = ['SPY', 'QQQ', 'NVDA', 'AAPL', 'TSLA', 'AMZN', 'META', 'MSFT', 'AMD', 'DIA', 'IWM']

// Sentiment-only cards use these pseudo tickers; they have no price, so they can't trend
const NON_TRADABLE = new Set(['OIL', 'GEO', 'CRYPTO', 'GENERAL', 'MACRO'])

export interface TrendingTicker {
  ticker: string
  posts: number     // creator Moves this week
  comments: number  // comments on this ticker's Moves and cards this week
  postsToday: number
  commentsToday: number
  calls: number     // Bullish/Bearish predictions this week — a stat, not part of the ranking
  bullish: number
  score: number
}

export const emptyTicker = (ticker: string): TrendingTicker =>
  ({ ticker, posts: 0, comments: 0, postsToday: 0, commentsToday: 0, calls: 0, bullish: 0, score: 0 })

/**
 * The stocks MarketJump is discussing: creator Moves and comments over the last 7 days,
 * with the last 24 hours counting double. Calls are reported alongside but don't rank.
 * If there's too little discussion, padded with the most-called tickers, then FALLBACK_TRENDING.
 */
export async function getTrendingTickers(supabase: SupabaseClient, limit = 12): Promise<TrendingTicker[]> {
  const weekAgo = Date.now() - 7 * 86400_000
  const dayAgo = Date.now() - 86400_000
  const since = new Date(weekAgo).toISOString()

  const [{ data: posts }, { data: comments }, { data: preds }] = await Promise.all([
    supabase.from('posts').select('ticker, created_at').gte('created_at', since).not('ticker', 'is', null).limit(5000),
    // A comment's ticker is the ticker of the Move or card it was left on
    supabase.from('comments').select('created_at, posts(ticker), jump_cards(ticker)').gte('created_at', since).limit(10000),
    supabase.from('predictions').select('ticker, prediction').gte('created_at', since).limit(10000),
  ])

  const map = new Map<string, TrendingTicker>()
  const entry = (raw: string) => {
    const t = raw.toUpperCase()
    if (!map.has(t)) map.set(t, emptyTicker(t))
    return map.get(t)!
  }
  const isToday = (iso: string) => new Date(iso).getTime() >= dayAgo

  for (const p of posts ?? []) {
    const e = entry(p.ticker)
    e.posts++
    if (isToday(p.created_at)) e.postsToday++
  }
  for (const c of comments ?? []) {
    // Embedded relations can come back as an object or a one-item array
    const one = (v: unknown) => (Array.isArray(v) ? v[0] : v) as { ticker?: string } | null
    const ticker = one(c.posts)?.ticker ?? one(c.jump_cards)?.ticker
    if (!ticker) continue // comments on outside news articles have no ticker
    const e = entry(ticker)
    e.comments++
    if (isToday(c.created_at)) e.commentsToday++
  }
  for (const p of preds ?? []) {
    if (!p.ticker) continue
    const e = entry(p.ticker)
    e.calls++
    if (p.prediction === 'bullish') e.bullish++
  }

  const all = [...map.values()]
    .filter(t => !NON_TRADABLE.has(t.ticker))
    .map(t => ({
      ...t,
      // A Move is worth 3 comments; today's discussion counts double
      score: (t.posts + t.postsToday) * 3 + t.comments + t.commentsToday,
    }))

  const discussed = all.filter(t => t.score > 0).sort((a, b) => b.score - a.score)
  const ranked = discussed.slice(0, limit)

  // Not enough discussion yet: next most-called, then the default list
  const pad = all.filter(t => t.score === 0 && t.calls > 0).sort((a, b) => b.calls - a.calls)
  for (const t of pad) {
    if (ranked.length >= limit) break
    ranked.push(t)
  }
  for (const t of FALLBACK_TRENDING) {
    if (ranked.length >= limit) break
    if (!ranked.some(r => r.ticker === t)) ranked.push(emptyTicker(t))
  }
  return ranked
}
