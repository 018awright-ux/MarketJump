'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LevelBadge from '@/components/LevelBadge'
import FollowButton from '@/components/FollowButton'
import type { UserLevel } from '@/lib/types'
import { useFollowState } from '@/lib/followStore'
import { fetchHiddenSections } from '@/lib/profilePrivacy'

interface ListProfile {
  id: string
  username: string
  brand_name: string | null
  brand_avatar_url: string | null
  level: UserLevel
}

// mode 'followers' = people who follow profileId (Audience); 'following' = people profileId follows
export default function FollowList({ profileId, mode }: { profileId: string; mode: 'followers' | 'following' }) {
  const router = useRouter()
  const [supabase] = useState<ReturnType<typeof createClient>>(
    () => (typeof window !== 'undefined' ? createClient() : null) as ReturnType<typeof createClient>
  )

  const [people, setPeople] = useState<ListProfile[]>([])
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [audienceHidden, setAudienceHidden] = useState(false)
  const { ready: viewerReady, viewerId } = useFollowState(profileId)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setFailed(false)

      const listQuery = mode === 'followers'
        ? supabase
            .from('follows')
            .select('person:profiles!follower_id(id, username, brand_name, brand_avatar_url, level)')
            .eq('following_id', profileId)
            .order('created_at', { ascending: false })
        : supabase
            .from('follows')
            .select('person:profiles!following_id(id, username, brand_name, brand_avatar_url, level)')
            .eq('follower_id', profileId)
            .order('created_at', { ascending: false })

      const [{ data: owner }, { data: rows, error }, hidden] = await Promise.all([
        supabase.from('profiles').select('username, brand_name').eq('id', profileId).single(),
        listQuery,
        fetchHiddenSections(supabase, profileId),
      ])
      if (cancelled) return
      setAudienceHidden(hidden.includes('audience'))

      if (owner) setDisplayName(owner.brand_name || owner.username)
      if (error) {
        console.error('FollowList query failed:', error.message)
        setFailed(true)
      }

      const list = (rows ?? [])
        .map((r: { person: ListProfile | ListProfile[] }) => (Array.isArray(r.person) ? r.person[0] : r.person))
        .filter(Boolean) as ListProfile[]
      setPeople(list)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase, profileId, mode])

  const title = mode === 'followers'
    ? (displayName ? `${displayName}'s Audience` : 'Audience')
    : (displayName ? `${displayName} is Following` : 'Following')

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#080c14' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-[#C9A84C]/10 flex-shrink-0">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex items-center gap-1.5 text-[#6b7280] hover:text-white transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-white font-black text-lg truncate">{title}</h1>
      </div>

      {loading || !viewerReady ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#6b7280] text-sm animate-pulse">Loading...</div>
        </div>
      ) : audienceHidden && viewerId !== profileId ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#6b7280] text-sm">This brand keeps its Audience private.</div>
        </div>
      ) : people.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#6b7280] text-sm">
            {failed ? 'Couldn’t load this list.' : mode === 'followers' ? 'No audience yet' : 'Not following anyone yet'}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {people.map(person => {
            const name = person.brand_name || person.username
            return (
              <div
                key={person.id}
                className="flex items-center gap-3 bg-[rgba(8,12,20,0.88)] rounded-xl border border-[#C9A84C]/20 p-3 backdrop-blur-md"
              >
                <Link href={`/profile/${person.id}`} className="flex items-center gap-3 flex-1 min-w-0 active:opacity-70 transition-opacity">
                  {person.brand_avatar_url ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-[#C9A84C]/20 flex-shrink-0">
                      <img src={person.brand_avatar_url} alt={name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#C9A84C]/20 border border-[#C9A84C]/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#C9A84C] text-sm font-black">{name.slice(0, 2).toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-bold text-sm truncate">{name}</div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {person.brand_name && <span className="text-[#6b7280] text-xs truncate">@{person.username}</span>}
                      <LevelBadge level={person.level} />
                    </div>
                  </div>
                </Link>
                <FollowButton targetId={person.id} size="sm" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
