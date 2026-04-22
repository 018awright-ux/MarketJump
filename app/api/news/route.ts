import { NextResponse } from 'next/server'

const FINNHUB_BASE = 'https://finnhub.io/api/v1'
const API_KEY = process.env.FINNHUB_API_KEY!

// Next.js Data Cache — persists across ALL serverless instances on Vercel
export const revalidate = 300 // 5 minutes

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json({ news: [] })
  }

  try {
    const res = await fetch(
      `${FINNHUB_BASE}/news?category=general&token=${API_KEY}`,
      { next: { revalidate: 300 } }
    )

    if (!res.ok) {
      console.error('Finnhub news error:', res.status, res.statusText)
      return NextResponse.json({ news: [] })
    }

    const articles = await res.json()

    if (!Array.isArray(articles)) {
      console.error('Finnhub news unexpected response:', typeof articles)
      return NextResponse.json({ news: [] })
    }

    const news = articles.slice(0, 20).map((a: {
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
      related: a.related,
    }))

    return NextResponse.json({ news, ts: Date.now() })
  } catch (err) {
    console.error('News route error:', err)
    return NextResponse.json({ news: [] })
  }
}
