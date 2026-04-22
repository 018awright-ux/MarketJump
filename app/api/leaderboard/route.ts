import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MOCK_USERS } from '@/lib/mock-data'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') ?? 'all'

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, brand_name, level, market_score, accuracy, total_predictions')
      .order('market_score', { ascending: false })
      .limit(50)

    if (error || !data?.length) {
      const mock = MOCK_USERS.map((u, i) => ({ ...u, rank: i + 1 }))
      return NextResponse.json({ leaderboard: mock, period })
    }

    const ranked = data.map((u, i) => ({ ...u, rank: i + 1 }))
    return NextResponse.json({ leaderboard: ranked, period })
  } catch {
    const mock = MOCK_USERS.map((u, i) => ({ ...u, rank: i + 1 }))
    return NextResponse.json({ leaderboard: mock, period })
  }
}
