import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isAuthorizedCron } from '@/lib/supabase/admin'
import { resolveDuePredictions } from '@/lib/scoring'
import { recalculateTiers } from '@/lib/recalculateTiers'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/judgment-day — Vercel cron, weekdays after the close (see vercel.json).
 * Scores every user's due Moves (new Moves are due Friday 4:30 PM NY), then
 * recalculates tiers from the updated scores. Runs on other weekdays too so
 * anything deferred (no price) or left over still gets scored.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const supabase = createAdminClient()
    const scoring = await resolveDuePredictions(supabase)
    const tiers = await recalculateTiers(supabase)
    console.log('[judgment-day]', JSON.stringify({ scoring, tiersUpdated: tiers.profiles_updated }))
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString(), scoring, tiers })
  } catch (e) {
    console.error('[judgment-day] failed:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
