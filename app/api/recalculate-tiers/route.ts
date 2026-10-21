import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isAuthorizedCron } from '@/lib/supabase/admin'
import { recalculateTiers } from '@/lib/recalculateTiers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/recalculate-tiers — manual trigger. The scheduled run now happens
 * inside /api/judgment-day, right after Moves are scored.
 * Protected by CRON_SECRET env var when set.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const result = await recalculateTiers(createAdminClient())
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString(), ...result })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
