import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/awards/vote
 * Body: { award_id: string, nominee_id: string }
 *
 * Rules enforced:
 * - Must be authenticated
 * - Must have >= 10 predictions (general awards) or any (Go-To Caller)
 * - Cannot vote for yourself
 * - One vote per user per award
 * - Voting must be open (Dec 15–29)
 *
 * Schema (add to Supabase when ready):
 *   CREATE TABLE award_votes (
 *     id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     user_id     uuid REFERENCES profiles(id),
 *     award_id    text NOT NULL,
 *     nominee_id  uuid REFERENCES profiles(id),
 *     year        int NOT NULL,
 *     created_at  timestamptz DEFAULT now(),
 *     UNIQUE(user_id, award_id, year)
 *   );
 */
export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: authHeader } },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { award_id, nominee_id } = await req.json()
  if (!award_id || !nominee_id) {
    return NextResponse.json({ error: 'award_id and nominee_id required' }, { status: 400 })
  }

  // Block self-vote
  if (nominee_id === user.id) {
    return NextResponse.json({ error: 'Cannot vote for yourself' }, { status: 400 })
  }

  // Check voting window
  const now = new Date()
  const votingOpen  = new Date('2025-12-15T00:00:00Z')
  const votingClose = new Date('2025-12-29T23:59:59Z')
  if (now < votingOpen || now > votingClose) {
    return NextResponse.json({ error: 'Voting is not currently open' }, { status: 403 })
  }

  // Check minimum predictions (10 for general awards)
  const { data: profile } = await supabase
    .from('profiles')
    .select('total_predictions')
    .eq('id', user.id)
    .single()

  if ((profile?.total_predictions ?? 0) < 10) {
    return NextResponse.json(
      { error: 'You need at least 10 predictions to vote' },
      { status: 403 }
    )
  }

  const year = new Date().getFullYear()

  // Insert vote (unique constraint prevents double-voting)
  const { error } = await supabase.from('award_votes').insert({
    user_id:    user.id,
    award_id,
    nominee_id,
    year,
  })

  if (error) {
    if (error.code === '23505') { // unique violation
      return NextResponse.json({ error: 'You have already voted for this award' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
