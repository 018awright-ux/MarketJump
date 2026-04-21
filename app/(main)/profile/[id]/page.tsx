'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LevelBadge from '@/components/LevelBadge'
import type { UserLevel } from '@/lib/types'

interface Profile {
  id: string
  username: string
  level: UserLevel
  market_score: number
  accuracy: number
  total_predictions: number
  correct_predictions: number
  followers: number
  following: number
}

interface Prediction {
  id: string
  ticker: string
  prediction: string
  price_at_prediction: number
  result: string
  resolved: boolean
  created_at: string
}

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)
  const [myVote, setMyVote] = useState<'bullish' | 'bearish' | null>(null)
  const [myId, setMyId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setMyId(user.id)
      const { data: vote } = await supabase
        .from('profile_votes')
        .select('vote')
        .eq('voter_id', user.id)
        .eq('target_id', id)
        .single()
      if (vote) setMyVote(vote.vote as 'bullish' | 'bearish')
    }

    const res = await fetch(`/api/profile/${id}`)
    const data = await res.json()
    if (data.profile) setProfile(data.profile)
    if (data.predictions) setPredictions(data.predictions)
    setLoading(false)
  }

  async function castVote(vote: 'bullish' | 'bearish') {
    if (!myId) return
    if (myVote === vote) {
      await supabase.from('profile_votes').delete().eq('voter_id', myId).eq('target_id', id)
      setMyVote(null)
    } else {
      await supabase.from('profile_votes').upsert({
        voter_id: myId, target_id: id, vote
      }, { onConflict: 'voter_id,target_id' })
      setMyVote(vote)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[#6b7280] text-sm animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[#6b7280] text-sm">User not found.</div>
      </div>
    )
  }

  // resolved list available for future use
  const _resolved = predictions.filter(p => p.resolved)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* Back + header */}
        <div className="px-5 pt-5 pb-4 border-b border-[#2a2a3a]">
          <button onClick={() => router.back()} className="text-[#6b7280] text-sm mb-4 flex items-center gap-1 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-black text-white">{profile.username}</h1>
                <LevelBadge level={profile.level} />
              </div>
              <div className="text-[#6b7280] text-xs">
                {profile.followers} followers · {profile.following} following
              </div>
            </div>
            <div className="text-right">
              <div className="text-[#00C805] font-black text-xl">{profile.market_score.toLocaleString()}</div>
              <div className="text-[#6b7280] text-[10px] uppercase tracking-wider">Score</div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-[#12121a] rounded-xl border border-[#2a2a3a] p-3 text-center">
              <div className="text-[#00C805] font-black text-lg">{profile.accuracy?.toFixed(1)}%</div>
              <div className="text-[#6b7280] text-[10px] uppercase">Accuracy</div>
            </div>
            <div className="bg-[#12121a] rounded-xl border border-[#2a2a3a] p-3 text-center">
              <div className="text-white font-black text-lg">{profile.total_predictions}</div>
              <div className="text-[#6b7280] text-[10px] uppercase">Total Calls</div>
            </div>
          </div>

          {/* Community vote */}
          {myId && myId !== id && (
            <div>
              <div className="text-[#6b7280] text-xs uppercase tracking-wider mb-2">Community Vote</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => castVote('bullish')}
                  className={`py-2 rounded-xl text-xs font-bold transition-colors border ${
                    myVote === 'bullish'
                      ? 'bg-[#00C805]/20 border-[#00C805] text-[#00C805]'
                      : 'bg-[#12121a] border-[#2a2a3a] text-[#6b7280] hover:border-[#00C805]/50'
                  }`}
                >
                  🐂 Credible
                </button>
                <button
                  onClick={() => castVote('bearish')}
                  className={`py-2 rounded-xl text-xs font-bold transition-colors border ${
                    myVote === 'bearish'
                      ? 'bg-[#FF3B30]/20 border-[#FF3B30] text-[#FF3B30]'
                      : 'bg-[#12121a] border-[#2a2a3a] text-[#6b7280] hover:border-[#FF3B30]/50'
                  }`}
                >
                  🐻 Low Confidence
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Prediction history */}
        <div className="px-5 pt-4 pb-4">
          <div className="text-xs text-[#6b7280] font-bold uppercase tracking-wider mb-3">
            Recent Predictions
          </div>
          <div className="space-y-2">
            {predictions.slice(0, 15).map(pred => (
              <div key={pred.id} className="bg-[#12121a] rounded-xl border border-[#2a2a3a] p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-sm">{pred.ticker}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      pred.prediction === 'bullish'
                        ? 'bg-[#00C805]/15 text-[#00C805]'
                        : 'bg-[#FF3B30]/15 text-[#FF3B30]'
                    }`}>
                      {pred.prediction === 'bullish' ? '🐂' : '🐻'} {pred.prediction}
                    </span>
                  </div>
                  <div className="text-[#6b7280] text-xs mt-0.5">
                    {new Date(pred.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  {pred.result === 'pending' ? (
                    <span className="text-[#6b7280] text-xs">⏳</span>
                  ) : pred.result === 'correct' ? (
                    <span className="text-[#00C805] text-xs">✓</span>
                  ) : (
                    <span className="text-[#FF3B30] text-xs">✗</span>
                  )}
                </div>
              </div>
            ))}
            {predictions.length === 0 && (
              <div className="text-center py-6 text-[#6b7280] text-sm">No predictions yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
