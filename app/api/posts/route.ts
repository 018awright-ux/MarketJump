import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker')

  let query = supabase
    .from('posts')
    .select(`
      *,
      post_videos(*),
      profiles(username, level, market_score)
    `)
    .order('created_at', { ascending: false })
    .limit(20)

  if (ticker) query = query.eq('ticker', ticker)

  const { data, error } = await query
  if (error) return NextResponse.json({ posts: [] })

  const posts = data.map((p: Record<string, unknown>) => ({
    ...p,
    videos: ((p.post_videos as unknown[]) ?? []).sort((a: unknown, b: unknown) => (a as {clip_order: number}).clip_order - (b as {clip_order: number}).clip_order),
    author: p.profiles,
  }))

  return NextResponse.json({ posts })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticker, caption, stance, videoData } = await req.json()
  // videoData: array of { storage_path, public_url, duration_seconds, clip_order, thumbnail_url }

  if (!ticker || !stance) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Create the post
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({ user_id: user.id, ticker, caption, stance })
    .select()
    .single()

  if (postError) return NextResponse.json({ error: postError.message }, { status: 500 })

  // Insert video records
  if (videoData?.length) {
    await supabase.from('post_videos').insert(
      videoData.map((v: Record<string, unknown>, i: number) => ({
        post_id: post.id,
        user_id: user.id,
        storage_path: v.storage_path,
        public_url: v.public_url,
        duration_seconds: v.duration_seconds ?? null,
        clip_order: i,
        thumbnail_url: v.thumbnail_url ?? null,
      }))
    )
  }

  return NextResponse.json({ post })
}
