import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: cards, error } = await supabase
      .from('jump_cards')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      console.error('Feed error:', error.message)
      return NextResponse.json({ cards: [] })
    }

    // Shuffle so feed order varies each session
    const shuffled = (cards ?? []).sort(() => Math.random() - 0.5)
    return NextResponse.json({ cards: shuffled })
  } catch (err) {
    console.error('Feed route error:', err)
    return NextResponse.json({ cards: [] })
  }
}
