'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  videos?: { id: string }[]
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

export default function BrandPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<BrandProfile | null>(null)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'live' | 'history' | 'analysis'>('live')
  const [editOpen, setEditOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [myVote, setMyVote] = useState<'agreed' | 'disagreed' | null>(null)
  const [voteLoading, setVoteLoading] = useState(false)

  // Edit form state
  const [editBrandName, setEditBrandName] = useState('')
  const [editTagline, setEditTagline] = useState('')
  const [editAvatarUrl, setEditAvatarUrl] = useState('')
  const [editLogoUrl, setEditLogoUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadBrand()
  }, [])

  async function loadBrand() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // First try with brand columns (available after running supabase-schema-brand.sql)
    let { data: p, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, username, brand_name, brand_tagline, brand_avatar_url, brand_logo_url, level, market_score, accuracy, total_predictions, correct_predictions, followers, following, agreed_count, disagreed_count')
      .eq('id', user.id)
      .single()

    // If brand columns don't exist yet, fall back to base columns
    if (fetchErr || !p) {
      const { data: pBase } = await supabase
        .from('profiles')
        .select('id, username, level, market_score, accuracy, total_predictions, correct_predictions, followers, following')
        .eq('id', user.id)
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
      if (created) {
        p = {
          ...created,
          brand_name: null,
          brand_tagline: null,
          brand_avatar_url: null,
          brand_logo_url: null,
          agreed_count: 0,
          disagreed_count: 0,
        }
      }
    }

    if (p) {
      setProfile(p as BrandProfile)
      setEditBrandName(p.brand_name ?? '')
      setEditTagline(p.brand_tagline ?? '')
      setEditAvatarUrl(p.brand_avatar_url ?? '')
      setEditLogoUrl(p.brand_logo_url ?? '')
    }

    const { data: preds } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (preds) setPredictions(preds)

    const { data: postsData } = await supabase
      .from('posts')
      .select('id, ticker, caption, stance, created_at, videos:post_videos(id)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
    if (postsData) setPosts(postsData as Post[])

    // Existing vote (brand_votes table only exists after running supabase-schema-brand.sql)
    try {
      const { data: voteRow } = await supabase
        .from('brand_votes')
        .select('vote')
        .eq('voter_id', user.id)
        .eq('target_id', user.id)
        .single()
      if (voteRow) setMyVote(voteRow.vote as 'agreed' | 'disagreed')
    } catch { /* table not yet created */ }

    setLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function handleShare() {
    const handle = profile?.brand_name || profile?.username || ''
    navigator.clipboard.writeText(`marketjump.com/${handle}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function uploadImage(file: File, folder: 'avatar' | 'logo'): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${folder}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('brand-avatars').upload(path, file, { upsert: true })
    if (error) { console.error(error); return null }
    const { data } = supabase.storage.from('brand-avatars').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const url = await uploadImage(file, 'avatar')
    if (url) setEditAvatarUrl(url)
    setUploadingAvatar(false)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    const url = await uploadImage(file, 'logo')
    if (url) setEditLogoUrl(url)
    setUploadingLogo(false)
  }

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    const updates: Record<string, string | null> = {
      brand_name: editBrandName.trim() || null,
      brand_tagline: editTagline.trim() || null,
      brand_avatar_url: editAvatarUrl.trim() || null,
      brand_logo_url: editLogoUrl.trim() || null,
    }
    const { data } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id)
      .select()
      .single()
    if (data) setProfile({ ...profile, ...data })
    setSaving(false)
    setEditOpen(false)
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[#6b7280] text-sm animate-pulse">Loading brand...</div>
      </div>
    )
  }

  if (!profile) return null

  const streak = computeStreak(predictions)
  const liveMoves = predictions.filter(p => !p.resolved)
  const moveHistory = predictions.filter(p => p.resolved)
  const bestMove = moveHistory.find(p => p.result === 'correct') ?? null
  const worstMove = moveHistory.find(p => p.result === 'incorrect') ?? null
  const displayName = profile.brand_name || profile.username
  const totalVotes = (profile.agreed_count || 0) + (profile.disagreed_count || 0)
  const agreedPct = totalVotes > 0 ? Math.round((profile.agreed_count / totalVotes) * 100) : 0

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* A. Brand Header */}
        <div className="px-5 pt-5 pb-4 border-b border-[#C9A84C]/10">
          {/* Share button row */}
          <div className="flex justify-end mb-4">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-[#C9A84C]/40 text-[#C9A84C] bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {copied ? 'Copied!' : 'Share Brand'}
            </button>
          </div>

          {/* Avatar / Logo */}
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

          {/* B. Brand Stats grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Brand Score', value: profile.market_score.toLocaleString(), color: '#C9A84C' },
              { label: 'Accuracy', value: `${profile.accuracy?.toFixed(1)}%`, color: '#00C805' },
              { label: 'Total Moves', value: profile.total_predictions, color: 'white' },
              { label: 'Audience', value: profile.followers, color: 'white' },
              { label: 'Agreed By', value: profile.agreed_count, sub: '⚡ Weighted', color: '#C9A84C' },
              {
                label: 'Best Move',
                value: bestMove ? `${bestMove.ticker} ${bestMove.prediction === 'bullish' ? '▲' : '▼'} ✓` : '—',
                color: bestMove ? '#00C805' : '#6b7280',
              },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-[rgba(8,12,20,0.88)] rounded-xl border border-[#C9A84C]/20 p-2.5 text-center backdrop-blur-md"
              >
                <div className="font-black text-sm leading-tight" style={{ color: stat.color }}>{stat.value}</div>
                {stat.sub && <div className="text-[#6b7280] text-[9px] mt-0.5">{stat.sub}</div>}
                <div className="text-[#6b7280] text-[9px] uppercase tracking-wider mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* C. Agreed By / Social Proof */}
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
          {/* Own profile: show credibility instead of vote buttons */}
          <div className="bg-[rgba(8,12,20,0.88)] rounded-xl border border-[#C9A84C]/20 px-4 py-3 text-center backdrop-blur-md">
            <div className="text-[#C9A84C] text-xs font-bold uppercase tracking-wider mb-0.5">Your Credibility Score</div>
            <div className="text-white font-black text-lg">{profile.market_score.toLocaleString()}</div>
            <div className="text-[#6b7280] text-[10px]">Based on Brand Score & accuracy</div>
          </div>
        </div>

        {/* D. Tab bar */}
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

          {/* Live Moves tab */}
          {activeTab === 'live' && (
            <div className="space-y-2 pb-4">
              {liveMoves.length === 0 ? (
                <div className="text-center py-10 text-[#6b7280] text-sm">
                  No live moves yet. Jump into the feed to make your first call.
                </div>
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

          {/* Move History tab */}
          {activeTab === 'history' && (
            <div className="space-y-2 pb-4">
              {/* Best/Worst move cards */}
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

          {/* Analysis tab */}
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
                    {post.videos && post.videos.length > 0 && (
                      <span className="text-[#6b7280] text-[10px]">🎬 {post.videos.length} clip{post.videos.length > 1 ? 's' : ''}</span>
                    )}
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

        {/* E. Sign out + Edit Brand button */}
        <div className="px-5 pb-6 flex gap-2">
          <button
            onClick={handleSignOut}
            className="px-4 py-2.5 rounded-xl text-xs font-bold border border-[#2a2a3a] text-[#6b7280] hover:text-white hover:border-[#6b7280] transition-colors"
          >
            Sign out
          </button>
          <button
            onClick={() => setEditOpen(true)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors"
          >
            Edit Brand
          </button>
        </div>
      </div>

      {/* Edit Brand slide-up modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div
            className="rounded-t-3xl border-t border-[#C9A84C]/20 backdrop-blur-md p-6 pb-10"
            style={{ background: 'rgba(8,12,20,0.97)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-black text-lg">Edit Brand</h2>
              <button
                onClick={() => setEditOpen(false)}
                className="text-[#6b7280] hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-1.5 block">Brand Name</label>
                <input
                  className="w-full bg-[#12121a] border border-[#C9A84C]/20 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#C9A84C]/60 transition-colors"
                  value={editBrandName}
                  onChange={e => setEditBrandName(e.target.value)}
                  placeholder="e.g. TheOilHawk"
                  maxLength={40}
                />
              </div>

              <div>
                <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-1.5 block">Brand Tagline</label>
                <input
                  className="w-full bg-[#12121a] border border-[#C9A84C]/20 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#C9A84C]/60 transition-colors"
                  value={editTagline}
                  onChange={e => setEditTagline(e.target.value.slice(0, 80))}
                  placeholder="e.g. Oil & energy plays since 2019"
                  maxLength={80}
                />
                <div className="text-right text-[#6b7280] text-[10px] mt-0.5">{editTagline.length}/80</div>
              </div>

              <div>
                <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-1.5 block">Brand Avatar URL</label>
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-[#12121a] border border-[#C9A84C]/20 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#C9A84C]/60 transition-colors"
                    value={editAvatarUrl}
                    onChange={e => setEditAvatarUrl(e.target.value)}
                    placeholder="Paste URL or upload"
                  />
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="px-3 py-2 rounded-xl text-xs font-bold border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors disabled:opacity-50"
                  >
                    {uploadingAvatar ? '...' : 'Upload'}
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </div>
              </div>

              <div>
                <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-1.5 block">Brand Logo URL</label>
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-[#12121a] border border-[#C9A84C]/20 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#C9A84C]/60 transition-colors"
                    value={editLogoUrl}
                    onChange={e => setEditLogoUrl(e.target.value)}
                    placeholder="Paste URL or upload"
                  />
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="px-3 py-2 rounded-xl text-xs font-bold border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors disabled:opacity-50"
                  >
                    {uploadingLogo ? '...' : 'Upload'}
                  </button>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3.5 rounded-xl font-black text-sm text-black transition-opacity disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96d)' }}
              >
                {saving ? 'Saving...' : 'Save Brand'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
