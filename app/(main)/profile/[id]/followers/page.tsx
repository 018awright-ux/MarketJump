'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LevelBadge from '@/components/LevelBadge'
import type { UserLevel } from '@/lib/types'

interface FollowerProfile {
  id: string
  username: string
  brand_name: string | null
  brand_avatar_url: string | null
  level: UserLevel
  market_score: number
}

function FollowersContent() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [followers, setFollowers] = useState<FollowerProfile[]>([])
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    setLoading(true)

    // Get brand display name
    const { data: p } = await supabase
      .from('profiles')
      .select('username, brand_name')
      .eq('id', id)
      .single()
    if (p) setDisplayName(p.brand_name || p.username)

    // Get followers
    const { data } = await supabase
      .from('follows')
      .select('follower:profiles!follower_id(id, username, brand_name, brand_avatar_url, level, market_score)')
      .eq('following_id', id)

    if (data) {
      const profiles = data
        .map((row: { follower: FollowerProfile | FollowerProfile[] }) =>
          Array.isArray(row.follower) ? row.follower[0] : row.follower
        )
        .filter(Boolean) as FollowerProfile[]
      setFollowers(profiles)
    }

    setLoading(false)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#080c14' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-[#C9A84C]/10 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[#6b7280] hover:text-white transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-white font-black text-lg truncate">
          {displayName ? `${displayName}'s Audience` : 'Audience'}
        </h1>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#6b7280] text-sm animate-pulse">Loading...</div>
        </div>
      ) : followers.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#6b7280] text-sm">No audience yet</div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {followers.map(follower => {
            const name = follower.brand_name || follower.username
            return (
              <button
                key={follower.id}
                onClick={() => router.push(`/profile/${follower.id}`)}
                className="w-full flex items-center gap-3 bg-[rgba(8,12,20,0.88)] rounded-xl border border-[#C9A84C]/20 p-3 text-left backdrop-blur-md active:opacity-70 transition-opacity"
              >
                {follower.brand_avatar_url ? (
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-[#C9A84C]/20 flex-shrink-0">
                    <img src={follower.brand_avatar_url} alt={name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#C9A84C]/20 border border-[#C9A84C]/40 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#C9A84C] text-sm font-black">
                      {name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm truncate">{name}</div>
                  <LevelBadge level={follower.level} />
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[#C9A84C] font-black text-sm">{follower.market_score.toLocaleString()}</div>
                  <div className="text-[#6b7280] text-[10px] uppercase tracking-wider">Score</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function FollowersPage() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center" style={{ background: '#080c14' }}>
        <div className="text-[#6b7280] text-sm animate-pulse">Loading...</div>
      </div>
    }>
      <FollowersContent />
    </Suspense>
  )
}
