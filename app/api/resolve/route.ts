import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveDuePredictions } from '@/lib/scoring'

// GET /api/resolve — score the current user's due Moves.
// Backup for the Judgment Day cron; safe to call on every profile load.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { resolved, correct, incorrect } = await resolveDuePredictions(supabase, { userId: user.id })
    return NextResponse.json({ resolved, correct, incorrect })
  } catch (err) {
    console.error('Resolve error:', err)
    return NextResponse.json({ resolved: 0, error: 'Resolution failed' })
  }
}
