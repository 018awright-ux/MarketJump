import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTier } from '@/lib/tier'

export const dynamic = 'force-dynamic'

/**
 * GET /api/recalculate-tiers
 *
 * Vercel cron hits this every Friday at midnight UTC (0 0 * * 5).
 * Recalculates every user's tier from their current market_score,
 * accuracy, and total_predictions, then persists changes to profiles.level.
 *
 * Guru is NOT permanent — users who drop below thresholds revert to Leader.
 *
 * Protected by CRON_SECRET env var when set.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey   = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY' },
      { status: 500 },
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, market_score, accuracy, total_predictions, level')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let updated = 0
  const changes: { id: string; old: string; new: string }[] = []

  for (const profile of profiles ?? []) {
    const calculated = getTier(
      profile.market_score       ?? 0,
      profile.accuracy           ?? 0,
      profile.total_predictions  ?? 0,
    )

    if (calculated.tier !== profile.level) {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ level: calculated.tier })
        .eq('id', profile.id)

      if (!updateErr) {
        changes.push({ id: profile.id, old: profile.level, new: calculated.tier })
        updated++
      }
    }
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    profiles_checked: profiles?.length ?? 0,
    profiles_updated: updated,
    changes,
  })
}
