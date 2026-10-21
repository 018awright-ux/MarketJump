import { NextRequest, NextResponse } from 'next/server'
import { getQuote, getCompanyNews } from '@/lib/finnhub'

interface Article { id?: number; headline: string; summary?: string; source: string; url: string; datetime: number }

// Calendar date (YYYY-MM-DD) in US market time, so "today" matches the trading day
function marketDate(d: Date) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const ticker = (await params).ticker.toUpperCase()

  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - 7)

  const [quote, rawNews] = await Promise.all([
    getQuote(ticker),
    // Finnhub filters by UTC date; pad a day each side and bucket by market date below
    getCompanyNews(ticker, from.toISOString().split('T')[0], new Date(today.getTime() + 86400_000).toISOString().split('T')[0]),
  ])

  // Newest first, drop syndicated duplicates
  const seen = new Set<string>()
  const articles: Article[] = (Array.isArray(rawNews) ? rawNews as Article[] : [])
    .filter(a => a?.headline && !seen.has(a.headline) && seen.add(a.headline))
    .sort((a, b) => b.datetime - a.datetime)

  // Every article from today; if there's none yet (weekend, quiet small cap), the latest day that has news
  const todayStr = marketDate(today)
  const byDay = (day: string) => articles.filter(a => marketDate(new Date(a.datetime * 1000)) === day)
  let newsDate = todayStr
  let news = byDay(todayStr)
  if (news.length === 0 && articles.length > 0) {
    newsDate = marketDate(new Date(articles[0].datetime * 1000))
    news = byDay(newsDate)
  }

  return NextResponse.json({
    ticker,
    quote,
    news,
    newsDate,
    newsIsToday: newsDate === todayStr,
  })
}
