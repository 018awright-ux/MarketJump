import { NextRequest, NextResponse } from 'next/server'
import { getQuote, getCompanyNews } from '@/lib/finnhub'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params

  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - 7)
  const fromStr = from.toISOString().split('T')[0]
  const toStr = today.toISOString().split('T')[0]

  const [quote, news] = await Promise.all([
    getQuote(ticker),
    getCompanyNews(ticker, fromStr, toStr),
  ])

  return NextResponse.json({
    ticker,
    quote,
    news: (news ?? []).slice(0, 5),
  })
}
