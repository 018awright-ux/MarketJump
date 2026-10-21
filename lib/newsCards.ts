import type { JumpCard } from '@/lib/types'

export interface StockArticle {
  id?: number
  headline: string
  summary?: string
  source: string
  url: string
  datetime: number
}

// Turn a stock's news (from /api/stocks/[ticker]) into Jump cards for that ticker,
// carrying the live quote so the card shows the real price and move
export function articlesToCards(
  ticker: string,
  articles: StockArticle[],
  quote: { c: number; dp: number } | null,
): JumpCard[] {
  return articles.map(a => ({
    id: `news-${ticker}-${a.id ?? a.datetime}`,
    ticker,
    headline: a.headline,
    summary: a.summary || a.headline,
    source: 'news',
    source_name: a.source,
    // No community votes on a live article yet — start neutral
    bull_percent: 50,
    bear_percent: 50,
    card_type: 'stock',
    price: quote?.c || undefined,
    change_percent: quote?.dp ?? undefined,
    created_at: new Date(a.datetime * 1000).toISOString(),
  }))
}

// Header label for a stock's news list, e.g. "12 articles today" or "3 articles · Fri, Oct 17"
export function newsLabel(count: number, newsDate: string | undefined, isToday: boolean | undefined) {
  const n = `${count} article${count === 1 ? '' : 's'}`
  if (isToday !== false || !newsDate) return `${n} today`
  const d = new Date(`${newsDate}T12:00:00`)
  return `${n} · ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
}
