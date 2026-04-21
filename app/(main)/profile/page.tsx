'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  interests: string[]
}

interface Prediction {
  id: string
  ticker: string
  prediction: string
  price_at_prediction: number
  result: string
  created_at: string
  resolved: boolean
}

interface ResolvedCall {
  ticker: string
  prediction: string
  result: string
  created_at: string
}

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active')
  const [bestCall, setBestCall] = useState<ResolvedCall | null>(null)
  const [worstCall, setWorstCall] = useState<ResolvedCall | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    let { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()

    // Auto-create profile if it doesn't exist yet (e.g. schema wasn't seeded via trigger)
    if (!p) {
      const username = user.email?.split('@')[0] ?? 'user'
      const { data: created } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          username,
          level: 'rookie',
          market_score: 1000,
          accuracy: 0,
          total_predictions: 0,
          correct_predictions: 0,
          followers: 0,
          following: 0,
          interests: [],
          onboarding_complete: false,
        })
        .select()
        .single()
      p = created
    }

    if (p) setProfile(p)

    const { data: preds } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (preds) setPredictions(preds)

    // Fetch best/worst calls separately for accuracy
    const { data: resolvedPreds } = await supabase
      .from('predictions')
      .select('ticker, prediction, result, created_at')
      .eq('user_id', user.id)
      .in('result', ['correct', 'incorrect'])
      .order('created_at', { ascending: false })
      .limit(20)
    if (resolvedPreds) {
      const best = resolvedPreds.find((p: { result: string }) => p.result === 'correct')
      const worst = resolvedPreds.find((p: { result: string }) => p.result === 'incorrect')
      setBestCall(best ?? null)
      setWorstCall(worst ?? null)
    }

    setLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[#6b7280] text-sm animate-pulse">Loading profile...</div>
      </div>
    )
  }

  if (!profile) return null

  const activePredictions = predictions.filter(p => !p.resolved)
  const history = predictions.filter(p => p.resolved)

  const levelProgress = {
    rookie: { next: 'Analyst', threshold: 1500, color: '#6b7280' },
    analyst: { next: 'Shark', threshold: 2500, color: '#40A9FF' },
    shark: { next: 'Shark', threshold: 9999, color: '#00C805' },
  }
  const prog = levelProgress[profile.level]
  const progressPct = Math.min(100, (profile.market_score / prog.threshold) * 100)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* Profile header */}
        <div className="px-5 pt-5 pb-4 border-b border-[#2a2a3a]">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-black text-white">{profile.username}</h1>
                <LevelBadge level={profile.level} />
              </div>
              <div className="text-[#6b7280] text-xs">
                {profile.interests.slice(0, 4).join(' · ')}
                {profile.interests.length > 4 && ` +${profile.interests.length - 4}`}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="text-[#6b7280] hover:text-white text-xs border border-[#2a2a3a] rounded-lg px-3 py-1.5 transition-colors"
            >
              Sign out
            </button>
          </div>

          {/* Market Score */}
          <div className="bg-[#12121a] rounded-2xl border border-[#2a2a3a] p-4 mb-4">
            <div className="text-[#6b7280] text-xs uppercase tracking-wider mb-1">Market Score</div>
            <div className="text-4xl font-black text-[#00C805] mb-2">{profile.market_score.toLocaleString()}</div>
            <div className="w-full h-1.5 bg-[#2a2a3a] rounded-full overflow-hidden mb-1">
              <div
                className="h-full rounded-full bg-[#00C805] transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {profile.level !== 'shark' && (
              <div className="text-[#6b7280] text-[10px]">
                {prog.threshold - profile.market_score} pts to {prog.next}
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-[#12121a] rounded-xl border border-[#2a2a3a] p-3 text-center">
              <div className="text-[#00C805] font-black text-lg">{profile.accuracy?.toFixed(1)}%</div>
              <div className="text-[#6b7280] text-[10px] uppercase tracking-wider">Accuracy</div>
            </div>
            <div className="bg-[#12121a] rounded-xl border border-[#2a2a3a] p-3 text-center">
              <div className="text-white font-black text-lg">{profile.total_predictions}</div>
              <div className="text-[#6b7280] text-[10px] uppercase tracking-wider">Calls</div>
            </div>
            <div className="bg-[#12121a] rounded-xl border border-[#2a2a3a] p-3 text-center">
              <div className="text-white font-black text-lg">{profile.correct_predictions}</div>
              <div className="text-[#6b7280] text-[10px] uppercase tracking-wider">Correct</div>
            </div>
          </div>

          {/* Followers */}
          <div className="flex gap-4">
            <div className="text-center">
              <span className="text-white font-bold text-sm">{profile.followers}</span>
              <span className="text-[#6b7280] text-xs ml-1">followers</span>
            </div>
            <div className="text-center">
              <span className="text-white font-bold text-sm">{profile.following}</span>
              <span className="text-[#6b7280] text-xs ml-1">following</span>
            </div>
          </div>
        </div>

        {/* Best/Worst call */}
        {(bestCall || worstCall) && (
          <div className="px-5 py-4 border-b border-[#2a2a3a]">
            <div className="grid grid-cols-2 gap-3">
              {bestCall && (
                <div className="bg-[#00C805]/10 border border-[#00C805]/20 rounded-xl p-3">
                  <div className="text-[#00C805] text-[10px] font-bold uppercase tracking-wider mb-1">Best Call</div>
                  <div className="text-white font-black">{bestCall.ticker}</div>
                  <div className="text-[#00C805] text-xs">
                    {bestCall.prediction === 'bullish' ? '🐂 Bullish' : '🐻 Bearish'} · Correct
                  </div>
                </div>
              )}
              {worstCall && (
                <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-xl p-3">
                  <div className="text-[#FF3B30] text-[10px] font-bold uppercase tracking-wider mb-1">Worst Call</div>
                  <div className="text-white font-black">{worstCall.ticker}</div>
                  <div className="text-[#FF3B30] text-xs">
                    {worstCall.prediction === 'bullish' ? '🐂 Bullish' : '🐻 Bearish'} · Wrong
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Predictions tabs */}
        <div className="px-5 pt-4">
          <div className="flex gap-2 bg-[#12121a] rounded-xl p-1 border border-[#2a2a3a] mb-4">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'active' ? 'bg-[#00C805] text-black' : 'text-[#6b7280] hover:text-white'
              }`}
            >
              Active ({activePredictions.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'history' ? 'bg-[#00C805] text-black' : 'text-[#6b7280] hover:text-white'
              }`}
            >
              History ({history.length})
            </button>
          </div>

          <div className="space-y-2 pb-4">
            {(activeTab === 'active' ? activePredictions : history).map(pred => (
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
                    @ ${pred.price_at_prediction?.toFixed(2)} · {new Date(pred.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  {pred.result === 'pending' ? (
                    <span className="text-[#6b7280] text-xs bg-[#1a1a26] px-2 py-1 rounded-lg">⏳ Pending</span>
                  ) : pred.result === 'correct' ? (
                    <span className="text-[#00C805] text-xs bg-[#00C805]/10 px-2 py-1 rounded-lg">✓ +10pts</span>
                  ) : (
                    <span className="text-[#FF3B30] text-xs bg-[#FF3B30]/10 px-2 py-1 rounded-lg">✗ -10pts</span>
                  )}
                </div>
              </div>
            ))}

            {(activeTab === 'active' ? activePredictions : history).length === 0 && (
              <div className="text-center py-8 text-[#6b7280] text-sm">
                {activeTab === 'active' ? 'No active predictions. Start swiping!' : 'No prediction history yet.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
