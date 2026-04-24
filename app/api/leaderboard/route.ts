import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Period = 'weekly' | 'monthly' | 'all_time'

const SCORE_CORRECT   = 50
const SCORE_INCORRECT = 20

/** Week runs Friday → Thursday. Roll back to last Friday 00:00 UTC. */
function startOfWeek(): string {
  const now = new Date()
  const day  = now.getUTCDay() // 0=Sun 1=Mon … 5=Fri 6=Sat
  // days since last Friday: Fri=0, Sat=1, Sun=2, Mon=3, Tue=4, Wed=5, Thu=6
  const daysSinceFri = (day - 5 + 7) % 7
  const d = new Date(now)
  d.setUTCDate(now.getUTCDate() - daysSinceFri)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

function startOfMonth(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const period = (searchParams.get('period') ?? 'weekly') as Period

  try {
    const supabase = await createClient()

    // ── All-time: rank directly by market_score ──────────────────────────────
    if (period === 'all_time') {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, brand_name, level, market_score, accuracy, total_predictions')
        .order('market_score', { ascending: false })
        .limit(50)

      if (error) return NextResponse.json({ leaderboard: [], period })

      const ranked = (data ?? []).map((u, i) => ({ ...u, rank: i + 1 }))
      return NextResponse.json({ leaderboard: ranked, period })
    }

    // ── Weekly / Monthly: score from resolved predictions in the window ──────
    const since = period === 'weekly' ? startOfWeek() : startOfMonth()

    // Fetch all resolved predictions in the window
    const { data: preds, error: predErr } = await supabase
      .from('predictions')
      .select('user_id, result')
      .eq('resolved', true)
      .gte('resolution_date', since)

    if (predErr) return NextResponse.json({ leaderboard: [], period })

    // Aggregate score per user
    const scoreMap: Record<string, number> = {}
    for (const p of (preds ?? [])) {
      const delta = p.result === 'correct' ? SCORE_CORRECT : -SCORE_INCORRECT
      scoreMap[p.user_id] = (scoreMap[p.user_id] ?? 0) + delta
    }

    const userIds = Object.keys(scoreMap)
    if (userIds.length === 0) return NextResponse.json({ leaderboard: [], period })

    // Fetch profile info for those users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, brand_name, level, market_score, accuracy, total_predictions')
      .in('id', userIds)

    // Build final ranked list (only include users with positive period score)
    const ranked = (profiles ?? [])
      .map(p => ({
        ...p,
        market_score: scoreMap[p.id] ?? 0, // override with period score for display
      }))
      .filter(p => p.market_score > 0)
      .sort((a, b) => b.market_score - a.market_score)
      .slice(0, 50)
      .map((p, i) => ({ ...p, rank: i + 1 }))

    return NextResponse.json({ leaderboard: ranked, period })
  } catch (e) {
    console.error('[leaderboard] error:', e)
    return NextResponse.json({ leaderboard: [], period })
  }
}
