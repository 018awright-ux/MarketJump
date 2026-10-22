import type { SupabaseClient } from '@supabase/supabase-js'
import { getQuote, getCompanyNews } from '@/lib/finnhub'
import { getTrendingTickers } from '@/lib/trending'
import { nextJudgmentDay } from '@/lib/judgmentDay'
import type { UserLevel } from '@/lib/types'

interface Prediction {
  ticker: string
  prediction: 'bullish' | 'bearish'
  price_at_prediction: number
  result: string
  resolved: boolean
  created_at: string
  resolution_date: string
}

export interface ConsultantContext {
  level: UserLevel
  text: string // compact, model-readable summary of the user's MarketJump status
}

const TICKER_RE = /\$([A-Za-z]{1,5})\b/g
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
const nyDate = (d: Date) => d.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** Tickers to look up: the stock on screen plus any $TICKER in the question (max 3) */
export function tickersFor(question: string, focus?: string | null): string[] {
  const found = [...question.matchAll(TICKER_RE)].map(m => m[1].toUpperCase())
  const all = [...(focus && /^[A-Z.]{1,6}$/.test(focus) ? [focus] : []), ...found]
  return [...new Set(all)].slice(0, 3)
}

/**
 * Everything ChatGPT can't see: the user's own record and open Moves, their Tracklist,
 * what MarketJump is discussing, and how the crowd and top-tier callers lean on the stocks asked about.
 * Built server-side from the user's session — the client can't inject or alter it.
 */
export async function buildContext(supabase: SupabaseClient, userId: string, tickers: string[]): Promise<ConsultantContext> {
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString()

  const [{ data: profile }, { data: open }, { data: recent }, { data: tracked }, trending] = await Promise.all([
    supabase.from('profiles')
      .select('username, brand_name, level, market_score, accuracy, total_predictions, correct_predictions')
      .eq('id', userId).single(),
    supabase.from('predictions')
      .select('ticker, prediction, price_at_prediction, result, resolved, created_at, resolution_date')
      .eq('user_id', userId).eq('resolved', false).gt('price_at_prediction', 0)
      .order('created_at', { ascending: false }).limit(15),
    supabase.from('predictions')
      .select('ticker, prediction, price_at_prediction, result, resolved, created_at, resolution_date')
      .eq('user_id', userId).eq('resolved', true)
      .order('resolution_date', { ascending: false }).limit(40),
    supabase.from('watchlist').select('ticker').eq('user_id', userId).limit(30),
    getTrendingTickers(supabase, 8).catch(() => []),
  ])

  const level = (profile?.level ?? 'rookie') as UserLevel
  const openMoves = (open ?? []) as Prediction[]
  const resolved = (recent ?? []) as Prediction[]

  // Live prices for open Moves and the tickers asked about (one quote per ticker)
  const quoteTickers = [...new Set([...tickers, ...openMoves.map(p => p.ticker)])].slice(0, 12)
  const quotes = new Map<string, { c: number; dp: number }>()
  await Promise.allSettled(quoteTickers.map(async t => {
    const q = await getQuote(t)
    if (q?.c > 0) quotes.set(t, { c: q.c, dp: q.dp ?? 0 })
  }))

  const lines: string[] = []
  const name = profile?.brand_name || profile?.username || 'this user'

  lines.push('## The user')
  lines.push(`${name} · tier ${level} · Brand Score ${profile?.market_score ?? 0} · overall accuracy ${profile?.accuracy ?? 0}% · ${profile?.correct_predictions ?? 0} correct calls · ${profile?.total_predictions ?? 0} calls made`)
  lines.push(`Next Judgment Day (open Moves are scored at this close): ${nyDate(nextJudgmentDay())} ET`)

  if (resolved.length) {
    // Accuracy by direction and by ticker — the patterns a consultant should notice
    const byDir = { bullish: [0, 0], bearish: [0, 0] } as Record<string, [number, number]>
    const byTicker = new Map<string, [number, number]>()
    for (const p of resolved) {
      const ok = p.result === 'correct' ? 1 : 0
      byDir[p.prediction][0] += ok; byDir[p.prediction][1]++
      const t = byTicker.get(p.ticker) ?? [0, 0]
      t[0] += ok; t[1]++; byTicker.set(p.ticker, t)
    }
    const rate = ([c, n]: [number, number]) => n ? `${Math.round((c / n) * 100)}% of ${n}` : 'none'
    lines.push(`Last ${resolved.length} scored calls: bullish ${rate(byDir.bullish)} correct, bearish ${rate(byDir.bearish)} correct`)
    const tickerStats = [...byTicker.entries()].filter(([, [, n]]) => n >= 2)
      .sort((a, b) => b[1][1] - a[1][1]).slice(0, 6)
      .map(([t, s]) => `${t} ${rate(s)}`)
    if (tickerStats.length) lines.push(`By ticker: ${tickerStats.join(' · ')}`)
  } else {
    lines.push('No scored calls yet.')
  }

  lines.push('', '## Open Moves (not yet scored)')
  if (openMoves.length) {
    for (const p of openMoves) {
      const q = quotes.get(p.ticker)
      const move = q ? ((q.c - p.price_at_prediction) / p.price_at_prediction) * 100 : null
      const winning = move === null ? '' : (p.prediction === 'bullish' ? move > 0 : move < 0) ? ' — currently winning' : ' — currently losing'
      lines.push(`- ${p.ticker} ${p.prediction} from $${p.price_at_prediction}${q ? `, now $${q.c} (${pct(move!)})${winning}` : ''}; scored ${nyDate(new Date(p.resolution_date))} ET`)
    }
  } else {
    lines.push('None.')
  }

  const trackedTickers = (tracked ?? []).map((r: { ticker: string }) => r.ticker)
  lines.push('', '## Tracklist', trackedTickers.length ? trackedTickers.join(', ') : 'Empty.')

  if (trending.length) {
    lines.push('', '## Trending on MarketJump this week (by discussion)')
    lines.push(trending.map((t, i) => {
      const talk = t.posts + t.comments
      const bull = t.calls ? `, ${Math.round((t.bullish / t.calls) * 100)}% bullish of ${t.calls} calls` : ''
      return `${i + 1}. ${t.ticker}${talk ? ` (${talk} posts/comments${bull})` : bull ? ` (${bull.slice(2)})` : ''}`
    }).join('\n'))
  }

  // Stocks in focus: live price, today's news, and how MarketJump is calling them
  for (const t of tickers) {
    const today = new Date().toISOString().split('T')[0]
    const [news, { data: calls }] = await Promise.all([
      getCompanyNews(t, today, today).catch(() => []),
      supabase.from('predictions').select('prediction, profiles(level)').eq('ticker', t).gte('created_at', weekAgo).limit(1000),
    ])
    const q = quotes.get(t)
    lines.push('', `## $${t}`)
    lines.push(q ? `Price $${q.c} (${pct(q.dp)} today)` : 'No live quote available (may not be a valid ticker).')

    const all = (calls ?? []) as { prediction: string; profiles: { level: string } | { level: string }[] | null }[]
    if (all.length) {
      const lvl = (c: typeof all[number]) => (Array.isArray(c.profiles) ? c.profiles[0] : c.profiles)?.level
      const bull = all.filter(c => c.prediction === 'bullish').length
      const top = all.filter(c => ['shark', 'leader', 'guru'].includes(lvl(c) ?? ''))
      const topBull = top.filter(c => c.prediction === 'bullish').length
      lines.push(`MarketJump calls this week: ${all.length} (${Math.round((bull / all.length) * 100)}% bullish)` +
        (top.length ? `; Shark/Leader/Guru tier: ${top.length} calls, ${Math.round((topBull / top.length) * 100)}% bullish` : ''))
    } else {
      lines.push('No MarketJump calls on it this week.')
    }

    const headlines = (Array.isArray(news) ? news : []).slice(0, 5)
      .map((n: { headline: string; source: string }) => `- ${n.headline} (${n.source})`)
    lines.push(headlines.length ? `Today's headlines:\n${headlines.join('\n')}` : 'No news today.')
  }

  return { level, text: lines.join('\n') }
}
