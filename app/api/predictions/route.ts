import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ predictions: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticker, prediction, price } = await req.json()
  if (!ticker || !prediction) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const resolutionDate = new Date()
  resolutionDate.setDate(resolutionDate.getDate() + 7)

  const { data, error } = await supabase.from('predictions').insert({
    user_id: user.id,
    ticker,
    prediction,
    price_at_prediction: price ?? 0,
    resolution_date: resolutionDate.toISOString(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Bump total_predictions count
  const { data: profile } = await supabase
    .from('profiles')
    .select('total_predictions')
    .eq('id', user.id)
    .single()

  await supabase.from('profiles').update({
    total_predictions: (profile?.total_predictions ?? 0) + 1,
  }).eq('id', user.id)

  return NextResponse.json({ prediction: data })
}
