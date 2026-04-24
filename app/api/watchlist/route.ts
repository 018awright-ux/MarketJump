import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('watchlist')
    .select('*, predictions(*)')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false })

  // Attach company names from jump_cards
  const tickers = (data ?? []).map((w: { ticker: string }) => w.ticker)
  const { data: cards } = tickers.length
    ? await supabase.from('jump_cards').select('ticker, company_name').in('ticker', tickers)
    : { data: [] }

  const companyMap: Record<string, string | null> = {}
  for (const c of (cards ?? [])) companyMap[c.ticker] = c.company_name ?? null

  const withCompany = (data ?? []).map((w: Record<string, unknown>) => ({
    ...w,
    company_name: companyMap[w.ticker as string] ?? null,
  }))

  return NextResponse.json({ watchlist: withCompany })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticker, predictionId } = await req.json()
  if (!ticker) return NextResponse.json({ error: 'Missing ticker' }, { status: 400 })

  const { data, error } = await supabase.from('watchlist').upsert({
    user_id: user.id,
    ticker,
    user_prediction_id: predictionId ?? null,
  }, { onConflict: 'user_id,ticker' }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticker } = await req.json()
  await supabase.from('watchlist').delete().eq('user_id', user.id).eq('ticker', ticker)
  return NextResponse.json({ ok: true })
}
