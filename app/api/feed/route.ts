import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MOCK_CARDS } from '@/lib/mock-data'

export async function GET() {
  try {
    const supabase = await createClient()

    // Try to get cards from DB
    const { data: cards, error } = await supabase
      .from('jump_cards')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error || !cards?.length) {
      // Fall back to mock data
      return NextResponse.json({ cards: MOCK_CARDS })
    }

    return NextResponse.json({ cards })
  } catch {
    return NextResponse.json({ cards: MOCK_CARDS })
  }
}
