'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface FollowButtonProps {
  targetId: string
  // Called after a successful toggle with +1 (followed) or -1 (unfollowed)
  onChange?: (delta: 1 | -1) => void
  className?: string
}

export default function FollowButton({ targetId, onChange, className = '' }: FollowButtonProps) {
  const [supabase] = useState<ReturnType<typeof createClient>>(() =>
    typeof window !== 'undefined' ? createClient() : null as unknown as ReturnType<typeof createClient>
  )
  const [myId, setMyId] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      setMyId(user?.id ?? null)
      if (user && user.id !== targetId) {
        const { data } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', user.id)
          .eq('following_id', targetId)
          .maybeSingle()
        if (!cancelled) setIsFollowing(!!data)
      }
      if (!cancelled) setReady(true)
    }
    load()
    return () => { cancelled = true }
  }, [supabase, targetId])

  async function toggle() {
    if (!myId || busy) return
    setBusy(true)
    // Counts on profiles are maintained by the on_follow_change DB trigger
    const { error } = isFollowing
      ? await supabase.from('follows').delete().eq('follower_id', myId).eq('following_id', targetId)
      : await supabase.from('follows').insert({ follower_id: myId, following_id: targetId })
    if (!error) {
      setIsFollowing(!isFollowing)
      onChange?.(isFollowing ? -1 : 1)
      // The Following feed is cached per session — drop it so it reflects the change
      try { sessionStorage.removeItem('mj_feed_cache_following') } catch {}
    }
    setBusy(false)
  }

  if (!ready) {
    return <div className={`w-full py-2.5 rounded-xl bg-[#1e2d4a]/40 animate-pulse ${className}`} style={{ height: 40 }} />
  }

  // Own profile — nothing to follow
  if (myId === targetId) return null

  // Logged out (public brand page) — send to login
  if (!myId) {
    return (
      <Link
        href="/login"
        className={`block w-full py-2.5 rounded-xl text-sm font-black text-center text-black ${className}`}
        style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96d)' }}
      >
        Log in to Follow
      </Link>
    )
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`w-full py-2.5 rounded-xl text-sm font-black transition-colors disabled:opacity-50 ${
        isFollowing
          ? 'border border-[#C9A84C] text-[#C9A84C] bg-transparent'
          : 'text-black'
      } ${className}`}
      style={!isFollowing ? { background: 'linear-gradient(135deg, #C9A84C, #e8c96d)' } : {}}
    >
      {isFollowing ? '✓ Following' : 'Follow Brand'}
    </button>
  )
}
