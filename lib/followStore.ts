'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'

// One shared copy of who the viewer follows, so any number of FollowButtons on a
// screen (Leaders, comments, feed) cost a single query and stay in sync.
interface FollowState {
  status: 'idle' | 'loading' | 'ready'
  viewerId: string | null
  following: Set<string>
  pending: Set<string>
}

let state: FollowState = { status: 'idle', viewerId: null, following: new Set(), pending: new Set() }
const listeners = new Set<() => void>()

function set(next: Partial<FollowState>) {
  state = { ...state, ...next }
  listeners.forEach(l => l())
}

let client: ReturnType<typeof createClient> | null = null
function supabase() {
  return (client ??= createClient())
}

let watchingAuth = false

async function load() {
  if (state.status !== 'idle') return
  set({ status: 'loading' })
  if (!watchingAuth) {
    watchingAuth = true
    // Logging out or switching accounts must not leak the previous user's follows
    supabase().auth.onAuthStateChange((_event, session) => {
      if ((session?.user.id ?? null) === state.viewerId || state.status !== 'ready') return
      state = { status: 'idle', viewerId: null, following: new Set(), pending: new Set() }
      load()
    })
  }
  const { data: { user } } = await supabase().auth.getUser()
  if (!user) return set({ status: 'ready', viewerId: null, following: new Set() })
  const { data } = await supabase().from('follows').select('following_id').eq('follower_id', user.id)
  set({
    status: 'ready',
    viewerId: user.id,
    following: new Set((data ?? []).map((r: { following_id: string }) => r.following_id)),
  })
}

// Returns true on success
export async function toggleFollow(targetId: string): Promise<boolean> {
  const { viewerId, following, pending } = state
  if (!viewerId || viewerId === targetId || pending.has(targetId)) return false
  const wasFollowing = following.has(targetId)
  set({ pending: new Set(pending).add(targetId) })

  // Counts on profiles are maintained by the on_follow_change DB trigger
  const { error } = wasFollowing
    ? await supabase().from('follows').delete().eq('follower_id', viewerId).eq('following_id', targetId)
    : await supabase().from('follows').insert({ follower_id: viewerId, following_id: targetId })

  const nextPending = new Set(state.pending)
  nextPending.delete(targetId)
  if (error) {
    set({ pending: nextPending })
    return false
  }
  const nextFollowing = new Set(state.following)
  if (wasFollowing) nextFollowing.delete(targetId)
  else nextFollowing.add(targetId)
  set({ following: nextFollowing, pending: nextPending })
  // The Following feed is cached per session — drop it so it reflects the change
  try { sessionStorage.removeItem('mj_feed_cache_following') } catch {}
  return true
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

const serverState: FollowState = { status: 'idle', viewerId: null, following: new Set(), pending: new Set() }

export function useFollowState(targetId: string) {
  const s = useSyncExternalStore(subscribe, () => state, () => serverState)
  useEffect(() => { load() }, [])
  return {
    ready: s.status === 'ready',
    viewerId: s.viewerId,
    isFollowing: s.following.has(targetId),
    busy: s.pending.has(targetId),
  }
}
