import { NextResponse } from 'next/server'
import { getMarketNews } from '@/lib/finnhub'

// Cache 5 minutes
let cache: { data: unknown; ts: number } | null = null

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.ts < 5 * 60_000) {
    return NextResponse.json(cache.data)
  }

  try {
    const articles = await getMarketNews('general')
    // Normalize and take top 15
    const news = (articles ?? []).slice(0, 15).map((a: {
      id: number
      headline: string
      summary: string
      source: string
      url: string
      datetime: number
      image?: string
      related?: string
    }) => ({
      id: a.id,
      headline: a.headline,
      summary: a.summary,
      source: a.source,
      url: a.url,
      datetime: a.datetime,
      image: a.image,
      related: a.related,
    }))

    const payload = { news, ts: now }
    cache = { data: payload, ts: now }
    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ news: [], ts: now })
  }
}
