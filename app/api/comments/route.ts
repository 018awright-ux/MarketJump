import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const postId = searchParams.get('post_id')
  const cardId = searchParams.get('card_id')
  const articleUrl = searchParams.get('article_url')

  if (!postId && !cardId && !articleUrl) {
    return NextResponse.json({ comments: [] })
  }

  const supabase = await createClient()
  let query = supabase
    .from('comments')
    .select('*, profiles(username, level)')
    .order('created_at', { ascending: true })
    .limit(50)

  if (postId) query = query.eq('post_id', postId)
  else if (cardId) query = query.eq('card_id', cardId)
  else if (articleUrl) query = query.eq('article_url', articleUrl)

  const { data, error } = await query
  if (error) return NextResponse.json({ comments: [] })
  return NextResponse.json({ comments: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { post_id, card_id, article_url, body } = await req.json()
  if (!body?.trim()) return NextResponse.json({ error: 'Empty comment' }, { status: 400 })
  if (!post_id && !card_id && !article_url) {
    return NextResponse.json({ error: 'Missing target' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({ user_id: user.id, post_id, card_id, article_url, body: body.trim() })
    .select('*, profiles(username, level)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comment: data })
}
