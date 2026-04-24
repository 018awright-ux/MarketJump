import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { caption, stance } = await req.json()

  const { data, error } = await supabase
    .from('posts')
    .update({ caption, stance })
    .eq('id', id)
    .eq('user_id', user.id) // only own posts
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ post: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Grab storage paths first so we can clean up files
  const { data: videos } = await supabase
    .from('post_videos')
    .select('storage_path')
    .eq('post_id', id)

  // Delete the post (cascades to post_videos, post_votes via FK)
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id) // only own posts

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Clean up storage files (best-effort)
  if (videos?.length) {
    const paths = videos.map((v: { storage_path: string }) => v.storage_path)
    await supabase.storage.from('post-videos').remove(paths)
  }

  return NextResponse.json({ ok: true })
}
