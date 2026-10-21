import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getQuote } from '@/lib/finnhub'
import { nextJudgmentDay } from '@/lib/judgmentDay'

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

  const body = await req.json()
  const ticker = typeof body.ticker === 'string' ? body.ticker.trim().toUpperCase() : ''
  const { prediction } = body
  if (!ticker || (prediction !== 'bullish' && prediction !== 'bearish')) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Price comes from the live quote, never the client: a $0 or made-up entry price
  // would let a Move be scored as correct regardless of what the stock did
  const quote = await getQuote(ticker).catch(() => null)
  const price = quote?.c
  if (!price || price <= 0) {
    return NextResponse.json({ error: 'No live price for this ticker right now. Try again shortly.' }, { status: 503 })
  }

  // Scored on the next Market Judgment Day (Friday 4:30 PM NY)
  const resolutionDate = nextJudgmentDay()

  const { data, error } = await supabase.from('predictions').insert({
    user_id: user.id,
    ticker,
    prediction,
    price_at_prediction: price,
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
