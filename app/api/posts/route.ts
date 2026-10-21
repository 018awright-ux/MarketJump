import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker')
  const following = searchParams.get('following') === '1'
  // Trending: Moves on any of these tickers from the last `days` days
  const tickers = searchParams.get('tickers')?.split(',').map(t => t.trim().toUpperCase()).filter(Boolean).slice(0, 20)
  const days = Number(searchParams.get('days')) || 0

  // Following feed: only posts from creators the current user follows
  let authorIds: string[] | null = null
  if (following) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ posts: [], followingCount: 0 })
    const { data: rows } = await supabase.from('follows').select('following_id').eq('follower_id', user.id)
    authorIds = (rows ?? []).map((r: { following_id: string }) => r.following_id)
    if (authorIds.length === 0) return NextResponse.json({ posts: [], followingCount: 0 })
  }

  let query = supabase
    .from('posts')
    .select(`
      *,
      post_videos(*),
      profiles(username, level, market_score),
      comments(id)
    `)
    .order('created_at', { ascending: false })
    .limit(following ? 50 : 20)

  if (ticker) query = query.eq('ticker', ticker)
  if (tickers?.length) query = query.in('ticker', tickers)
  if (days > 0) query = query.gte('created_at', new Date(Date.now() - days * 86400_000).toISOString())
  if (authorIds) query = query.in('user_id', authorIds)

  const { data, error } = await query
  if (error) return NextResponse.json({ posts: [] })

  const posts = data.map((p: Record<string, unknown>) => ({
    ...p,
    videos: ((p.post_videos as unknown[]) ?? []).sort((a: unknown, b: unknown) => (a as {clip_order: number}).clip_order - (b as {clip_order: number}).clip_order),
    author: p.profiles,
    comment_count: Array.isArray(p.comments) ? (p.comments as unknown[]).length : 0,
  }))

  return NextResponse.json(authorIds ? { posts, followingCount: authorIds.length } : { posts })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticker, caption, stance, videoData } = await req.json()
  // videoData: array of { storage_path, public_url, duration_seconds, clip_order, thumbnail_url }
  // ticker is optional — posts can be general discussion without a tagged stock

  if (!stance) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (!caption?.trim() && !videoData?.length) {
    return NextResponse.json({ error: 'Post needs text or media' }, { status: 400 })
  }

  // Create the post — ticker may be null for general posts
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({ user_id: user.id, ticker: ticker || null, caption, stance })
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
        media_type: v.media_type ?? 'video',
      }))
    )
  }

  return NextResponse.json({ post })
}
