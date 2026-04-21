'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LevelBadge from '@/components/LevelBadge'
import type { UserLevel } from '@/lib/types'

interface BrandProfile {
  id: string
  username: string
  brand_name: string | null
  brand_tagline: string | null
  brand_avatar_url: string | null
  brand_logo_url: string | null
  level: UserLevel
  market_score: number
  accuracy: number
  total_predictions: number
  correct_predictions: number
  followers: number
  following: number
  agreed_count: number
  disagreed_count: number
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

interface Post {
  id: string
  ticker: string
  caption: string | null
  stance: string
  created_at: string
}

function computeStreak(preds: Prediction[]): { type: 'hot' | 'cold' | 'none'; count: number } {
  const resolved = preds.filter(p => p.resolved && (p.result === 'correct' || p.result === 'incorrect'))
  if (resolved.length === 0) return { type: 'none', count: 0 }
  const first = resolved[0].result
  let count = 0
  for (const p of resolved) {
    if (p.result === first) count++
    else break
  }
  if (first === 'correct' && count >= 3) return { type: 'hot', count }
  if (first === 'incorrect' && count >= 2) return { type: 'cold', count }
  return { type: 'none', count: 0 }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function PublicBrandPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<BrandProfile | null>(null)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'live' | 'history' | 'analysis'>('live')
  const [myId, setMyId] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [myVote, setMyVote] = useState<'agreed' | 'disagreed' | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id ?? null
    setMyId(userId)

    // Fetch brand profile
    let { data: p, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, username, brand_name, brand_tagline, brand_avatar_url, brand_logo_url, level, market_score, accuracy, total_predictions, correct_predictions, followers, following, agreed_count, disagreed_count')
      .eq('id', id)
      .single()

    if (fetchErr || !p) {
      const { data: pBase } = await supabase
        .from('profiles')
        .select('id, username, level, market_score, accuracy, total_predictions, correct_predictions, followers, following')
        .eq('id', id)
        .single()
      if (pBase) {
        p = {
          ...pBase,
          brand_name: null,
          brand_tagline: null,
          brand_avatar_url: null,
          brand_logo_url: null,
          agreed_count: 0,
          disagreed_count: 0,
        }
      }
    }

    if (p) setProfile(p as BrandProfile)

    // Fetch predictions
    const { data: preds } = await supabase
      .from('predictions')
      .select('id, ticker, prediction, result, price_at_prediction, created_at, resolved')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (preds) setPredictions(preds)

    // Fetch posts
    const { data: postsData } = await supabase
      .from('posts')
      .select('id, ticker, caption, stance, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(10)
    if (postsData) setPosts(postsData as Post[])

    // Follow status
    if (userId) {
      try {
        const { data: followRow } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', userId)
          .eq('following_id', id)
          .single()
        setIsFollowing(!!followRow)
      } catch { /* table may not exist */ }

      // Brand vote
      try {
        const { data: voteRow } = await supabase
          .from('brand_votes')
          .select('vote')
          .eq('voter_id', userId)
          .eq('target_id', id)
          .single()
        if (voteRow) setMyVote(voteRow.vote as 'agreed' | 'disagreed')
      } catch { /* table may not exist */ }
    }

    setLoading(false)
  }

  async function handleFollow() {
    if (!myId || !profile) return
    setFollowLoading(true)
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', myId).eq('following_id', id)
      setIsFollowing(false)
      setProfile(prev => prev ? { ...prev, followers: Math.max(0, prev.followers - 1) } : prev)
    } else {
      await supabase.from('follows').upsert({ follower_id: myId, following_id: id }, { onConflict: 'follower_id,following_id' })
      setIsFollowing(true)
      setProfile(prev => prev ? { ...prev, followers: prev.followers + 1 } : prev)
    }
    setFollowLoading(false)
  }

  async function handleVote(vote: 'agreed' | 'disagreed') {
    if (!myId || !profile) return
    if (myVote === vote) {
      await supabase.from('brand_votes').delete().eq('voter_id', myId).eq('target_id', id)
      setMyVote(null)
    } else {
      await supabase.from('brand_votes').upsert({ voter_id: myId, target_id: id, vote }, { onConflict: 'voter_id,target_id' })
      // Optimistic update
      setProfile(prev => {
        if (!prev) return prev
        const delta = myVote === null ? 1 : 0
        return {
          ...prev,
          agreed_count: vote === 'agreed' ? prev.agreed_count + delta : (myVote === 'agreed' ? prev.agreed_count - 1 : prev.agreed_count),
          disagreed_count: vote === 'disagreed' ? prev.disagreed_count + delta : (myVote === 'disagreed' ? prev.disagreed_count - 1 : prev.disagreed_count),
        }
      })
      setMyVote(vote)
    }
  }

  function handleShare() {
    if (!profile) return
    const handle = profile.brand_name || profile.username
    navigator.clipboard.writeText(`marketjump.com/${handle}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[#6b7280] text-sm animate-pulse">Loading brand...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[#6b7280] text-sm">Brand not found.</div>
      </div>
    )
  }

  const streak = computeStreak(predictions)
  const liveMoves = predictions.filter(p => !p.resolved)
  const moveHistory = predictions.filter(p => p.resolved)
  const bestMove = moveHistory.find(p => p.result === 'correct') ?? null
  const worstMove = moveHistory.find(p => p.result === 'incorrect') ?? null
  const displayName = profile.brand_name || profile.username
  const totalVotes = (profile.agreed_count || 0) + (profile.disagreed_count || 0)
  const agreedPct = totalVotes > 0 ? Math.round((profile.agreed_count / totalVotes) * 100) : 0
  const isOwnProfile = myId === id

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-[#C9A84C]/10">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-[#6b7280] hover:text-white transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-[#C9A84C]/40 text-[#C9A84C] bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>

          {/* Avatar / Logo + Name */}
          <div className="flex items-start gap-4 mb-4">
            <div className="relative flex-shrink-0">
              {profile.brand_logo_url ? (
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#C9A84C]/40">
                  <img src={profile.brand_logo_url} alt="brand logo" className="w-full h-full object-cover" />
                </div>
              ) : profile.brand_avatar_url ? (
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#C9A84C]/20">
                  <img src={profile.brand_avatar_url} alt="brand avatar" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#C9A84C]/20 border-2 border-[#C9A84C]/40 flex items-center justify-center">
                  <span className="text-[#C9A84C] text-2xl font-black">
                    {displayName.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-white truncate">{displayName}</h1>
              {profile.brand_tagline && (
                <p className="text-[#9ca3af] text-sm italic mt-0.5 leading-snug">{profile.brand_tagline}</p>
              )}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <LevelBadge level={profile.level} />
                {streak.type === 'hot' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 text-xs font-bold">
                    🔥 {streak.count} move streak
                  </span>
                )}
                {streak.type === 'cold' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 text-xs font-bold">
                    ❄️ Cold streak ({streak.count})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats 2x2 grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { label: 'Brand Score', value: profile.market_score.toLocaleString(), color: '#C9A84C' },
              { label: 'Accuracy', value: `${profile.accuracy?.toFixed(1)}%`, color: '#00C805' },
              { label: 'Total Moves', value: profile.total_predictions, color: 'white' },
              { label: 'Audience', value: profile.followers, color: 'white', tappable: true },
            ].map((stat, i) => (
              <div
                key={i}
                className={`bg-[rgba(8,12,20,0.88)] rounded-xl border border-[#C9A84C]/20 p-2.5 text-center backdrop-blur-md ${stat.tappable ? 'cursor-pointer active:opacity-70' : ''}`}
                onClick={stat.tappable ? () => router.push(`/profile/${id}/followers`) : undefined}
              >
                <div className="font-black text-sm leading-tight" style={{ color: stat.color }}>{stat.value}</div>
                <div className="text-[#6b7280] text-[9px] uppercase tracking-wider mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Follow button (not own profile) */}
          {!isOwnProfile && myId && (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={`w-full py-2.5 rounded-xl text-sm font-black transition-colors disabled:opacity-50 ${
                isFollowing
                  ? 'border border-[#C9A84C] text-[#C9A84C] bg-transparent'
                  : 'text-black'
              }`}
              style={!isFollowing ? { background: 'linear-gradient(135deg, #C9A84C, #e8c96d)' } : {}}
            >
              {isFollowing ? '✓ Following' : 'Follow Brand'}
            </button>
          )}
        </div>

        {/* Agreed By section */}
        <div className="px-5 py-4 border-b border-[#C9A84C]/10">
          <div className="text-white font-bold text-sm mb-2">
            Agreed by {profile.agreed_count} traders
          </div>
          <div className="w-full h-2 rounded-full bg-[#2a2a3a] overflow-hidden mb-1">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${agreedPct}%`,
                background: agreedPct >= 50 ? '#00C805' : '#FF3B30',
              }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-[#6b7280] mb-3">
            <span>{agreedPct}% Agreed</span>
            <span>Votes weighted by Brand Score</span>
          </div>

          {/* Vote buttons (not own profile) */}
          {!isOwnProfile && myId && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleVote('agreed')}
                className={`py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                  myVote === 'agreed'
                    ? 'bg-[#00C805]/20 border-[#00C805] text-[#00C805]'
                    : 'bg-[#12121a] border-[#2a2a3a] text-[#6b7280] hover:border-[#00C805]/50'
                }`}
              >
                ✓ Agree
              </button>
              <button
                onClick={() => handleVote('disagreed')}
                className={`py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                  myVote === 'disagreed'
                    ? 'bg-[#FF3B30]/20 border-[#FF3B30] text-[#FF3B30]'
                    : 'bg-[#12121a] border-[#2a2a3a] text-[#6b7280] hover:border-[#FF3B30]/50'
                }`}
              >
                ✗ Disagree
              </button>
            </div>
          )}

          {/* Own profile credibility */}
          {isOwnProfile && (
            <div className="bg-[rgba(8,12,20,0.88)] rounded-xl border border-[#C9A84C]/20 px-4 py-3 text-center backdrop-blur-md">
              <div className="text-[#C9A84C] text-xs font-bold uppercase tracking-wider mb-0.5">Your Credibility Score</div>
              <div className="text-white font-black text-lg">{profile.market_score.toLocaleString()}</div>
              <div className="text-[#6b7280] text-[10px]">Based on Brand Score & accuracy</div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4">
          <div className="flex gap-1 bg-[rgba(8,12,20,0.88)] rounded-xl p-1 border border-[#C9A84C]/20 mb-4 backdrop-blur-md">
            {(['live', 'history', 'analysis'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === tab
                    ? 'bg-[#C9A84C] text-black'
                    : 'text-[#6b7280] hover:text-white'
                }`}
              >
                {tab === 'live' ? 'Live Moves' : tab === 'history' ? 'Move History' : 'Analysis'}
              </button>
            ))}
          </div>

          {/* Live Moves */}
          {activeTab === 'live' && (
            <div className="space-y-2 pb-4">
              {liveMoves.length === 0 ? (
                <div className="text-center py-10 text-[#6b7280] text-sm">No live moves right now.</div>
              ) : liveMoves.map(pred => (
                <div
                  key={pred.id}
                  className="bg-[rgba(8,12,20,0.88)] rounded-xl border border-[#C9A84C]/20 p-3 flex items-center justify-between backdrop-blur-md"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-[#1B3066]/60 text-[#C9A84C] text-xs font-black">
                        {pred.ticker}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        pred.prediction === 'bullish'
                          ? 'bg-[#00C805]/15 text-[#00C805]'
                          : 'bg-[#FF3B30]/15 text-[#FF3B30]'
                      }`}>
                        {pred.prediction === 'bullish' ? '🐂 Bull' : '🐻 Bear'}
                      </span>
                    </div>
                    <div className="text-[#9ca3af] text-xs mt-1">
                      Called at ${pred.price_at_prediction?.toFixed(2)} · {timeAgo(pred.created_at)}
                    </div>
                  </div>
                  <span className="text-[#6b7280] text-xs bg-[#1a1a26] px-2 py-1 rounded-lg">⏳ Pending</span>
                </div>
              ))}
            </div>
          )}

          {/* Move History */}
          {activeTab === 'history' && (
            <div className="space-y-2 pb-4">
              {(bestMove || worstMove) && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {bestMove && (
                    <div className="bg-[#00C805]/10 border border-[#00C805]/20 rounded-xl p-3">
                      <div className="text-[#00C805] text-[10px] font-bold uppercase tracking-wider mb-1">Best Move</div>
                      <div className="text-white font-black">{bestMove.ticker}</div>
                      <div className="text-[#00C805] text-xs">
                        {bestMove.prediction === 'bullish' ? '🐂 Bull' : '🐻 Bear'} ✓
                      </div>
                    </div>
                  )}
                  {worstMove && (
                    <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-xl p-3">
                      <div className="text-[#FF3B30] text-[10px] font-bold uppercase tracking-wider mb-1">Worst Move</div>
                      <div className="text-white font-black">{worstMove.ticker}</div>
                      <div className="text-[#FF3B30] text-xs">
                        {worstMove.prediction === 'bullish' ? '🐂 Bull' : '🐻 Bear'} ✗
                      </div>
                    </div>
                  )}
                </div>
              )}
              {moveHistory.length === 0 ? (
                <div className="text-center py-10 text-[#6b7280] text-sm">No move history yet.</div>
              ) : moveHistory.map(pred => (
                <div
                  key={pred.id}
                  className="bg-[rgba(8,12,20,0.88)] rounded-xl border border-[#C9A84C]/20 p-3 flex items-center justify-between backdrop-blur-md"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-[#1B3066]/60 text-[#C9A84C] text-xs font-black">
                        {pred.ticker}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        pred.prediction === 'bullish'
                          ? 'bg-[#00C805]/15 text-[#00C805]'
                          : 'bg-[#FF3B30]/15 text-[#FF3B30]'
                      }`}>
                        {pred.prediction === 'bullish' ? '🐂 Bull' : '🐻 Bear'}
                      </span>
                    </div>
                    <div className="text-[#9ca3af] text-xs mt-1">
                      Called at ${pred.price_at_prediction?.toFixed(2)} · {new Date(pred.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    {pred.result === 'correct' ? (
                      <span className="text-[#00C805] text-xs bg-[#00C805]/10 px-2 py-1 rounded-lg">✓ Correct</span>
                    ) : pred.result === 'incorrect' ? (
                      <span className="text-[#FF3B30] text-xs bg-[#FF3B30]/10 px-2 py-1 rounded-lg">✗ Wrong</span>
                    ) : (
                      <span className="text-[#6b7280] text-xs bg-[#1a1a26] px-2 py-1 rounded-lg">⏳ Pending</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Analysis */}
          {activeTab === 'analysis' && (
            <div className="space-y-2 pb-4">
              {posts.length === 0 ? (
                <div className="text-center py-10 text-[#6b7280] text-sm">No analysis posted yet.</div>
              ) : posts.map(post => (
                <div
                  key={post.id}
                  className="bg-[rgba(8,12,20,0.88)] rounded-xl border border-[#C9A84C]/20 p-3 backdrop-blur-md"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-[#1B3066]/60 text-[#C9A84C] text-xs font-black">
                      {post.ticker}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      post.stance === 'bullish'
                        ? 'bg-[#00C805]/15 text-[#00C805]'
                        : post.stance === 'bearish'
                          ? 'bg-[#FF3B30]/15 text-[#FF3B30]'
                          : 'bg-[#6b7280]/15 text-[#9ca3af]'
                    }`}>
                      {post.stance === 'bullish' ? '🐂' : post.stance === 'bearish' ? '🐻' : '—'} {post.stance}
                    </span>
                  </div>
                  {post.caption && (
                    <p className="text-[#9ca3af] text-xs leading-snug line-clamp-2">{post.caption}</p>
                  )}
                  <div className="text-[#6b7280] text-[10px] mt-1">{new Date(post.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
