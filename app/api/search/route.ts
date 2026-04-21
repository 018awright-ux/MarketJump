import { NextRequest, NextResponse } from 'next/server'
import { searchSymbol, getQuote } from '@/lib/finnhub'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  if (!q) return NextResponse.json({ results: [] })

  try {
    const data = await searchSymbol(q)
    const results = (data.result ?? [])
      .filter((r: { type: string }) => r.type === 'Common Stock')
      .slice(0, 8)
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
