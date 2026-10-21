import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { lastJudgmentDay } from '@/lib/judgmentDay'
import { SCORE_CORRECT, SCORE_INCORRECT } from '@/lib/scoring'

type Period = 'weekly' | 'monthly' | 'all_time'

/**
 * The weekly board shows the latest Judgment Day's results: Moves due after the
 * previous Judgment Day, up to now. It flips to the new week's results each Friday at 4:30 PM NY.
 */
function startOfWeek(): string {
  return new Date(lastJudgmentDay().getTime() - 7 * 86400_000 + 1000).toISOString()
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
        // Everyone starts at 1,000 — only rank people who've actually made a Move
        .gt('total_predictions', 0)
        .order('market_score', { ascending: false })
        .limit(50)

      if (error) return NextResponse.json({ leaderboard: [], period })

      const ranked = (data ?? []).map((u, i) => ({ ...u, user_id: u.id, rank: i + 1 }))
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
      .map((p, i) => ({ ...p, user_id: p.id, rank: i + 1 }))

    return NextResponse.json({ leaderboard: ranked, period })
  } catch (e) {
    console.error('[leaderboard] error:', e)
    return NextResponse.json({ leaderboard: [], period })
  }
}
