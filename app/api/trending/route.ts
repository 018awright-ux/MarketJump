import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTrendingTickers, FALLBACK_TRENDING, emptyTicker } from '@/lib/trending'

// GET /api/trending — tickers ranked by how much MarketJump is discussing them (Moves + comments)
export async function GET() {
  try {
    const supabase = await createClient()
    return NextResponse.json({ trending: await getTrendingTickers(supabase) })
  } catch (e) {
    console.error('[trending] error:', e)
    return NextResponse.json({
      trending: FALLBACK_TRENDING.map(emptyTicker),
    })
  }
}
