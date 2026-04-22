import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/votes — record a card-level bull/bear vote and refresh card sentiment
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { card_id, vote } = await req.json()
    if (!card_id || !vote) return NextResponse.json({ error: 'Missing card_id or vote' }, { status: 400 })

    // Upsert vote (one vote per user per card)
    const { error: voteError } = await supabase
      .from('user_votes')
      .upsert({ user_id: user.id, card_id, vote }, { onConflict: 'user_id,card_id' })

    if (voteError) {
      // Table may not exist yet — return gracefully
      return NextResponse.json({ ok: true, skipped: true })
    }

    // Recalculate sentiment for the card
    const { data: allVotes } = await supabase
      .from('user_votes')
      .select('vote')
      .eq('card_id', card_id)

    if (allVotes && allVotes.length > 0) {
      const total = allVotes.length
      const bullCount = allVotes.filter(v => v.vote === 'bullish').length
      const bullPercent = Math.round((bullCount / total) * 100)
      const bearPercent = 100 - bullPercent

      await supabase
        .from('jump_cards')
        .update({ bull_percent: bullPercent, bear_percent: bearPercent })
        .eq('id', card_id)

      return NextResponse.json({ ok: true, bull_percent: bullPercent, bear_percent: bearPercent })
    }

    return NextResponse.json({ ok: true })
  } catch {
    // Never crash the feed over a vote failure
    return NextResponse.json({ ok: true, skipped: true })
  }
}
