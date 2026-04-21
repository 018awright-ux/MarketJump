import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ profile, predictions: predictions ?? [] })
}
