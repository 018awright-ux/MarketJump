'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LevelBadge from '@/components/LevelBadge'
import TickerDetailView from '@/components/TickerDetailView'
import PullIndicator from '@/components/PullIndicator'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
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
  interests?: string[]
}

interface Prediction {
  id: string
  ticker: string
  prediction: string
  price_at_prediction: number
  result: string
  created_at: string
  resolved: boolean
  resolution_date?: string | null
}

interface PostVideo {
  id: string
  public_url: string
  clip_order: number
  duration_seconds: number | null
  media_type: 'video' | 'image'
}

interface Post {
  id: string
  ticker: string
  caption: string | null
  stance: string
  created_at: string
  bull_votes: number
  bear_votes: number
  view_count: number
  comment_count?: number
  videos?: PostVideo[]
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
  const [openTicker, setOpenTicker]     = useState<{ ticker: string; prediction: string; price: number } | null>(null)
  const [editOpen, setEditOpen]         = useState(false)
  const [scoreCountdown, setScoreCountdown] = useState('')
  const [viewingPost, setViewingPost]   = useState<Post | null>(null)
  const [viewClipIndex, setViewClipIndex] = useState(0)
  const [postMenuId, setPostMenuId]     = useState<string | null>(null)
  const [editingPost, setEditingPost]   = useState<Post | null>(null)
  const [editCaption, setEditCaption]   = useState('')
  const [editStance, setEditStance]     = useState<'bullish' | 'bearish' | 'neutral'>('neutral')
  const [savingPost, setSavingPost]     = useState(false)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const ptr = usePullToRefresh(async () => { await loadBrand() })

  // Live countdown to next Friday score update
  useEffect(() => {
    function nextFriday(): Date {
      const now = new Date()
      const day = now.getUTCDay()
      const daysAway = (5 - day + 7) % 7 || 7
      const d = new Date(now)
      d.setUTCDate(now.getUTCDate() + daysAway)
      d.setUTCHours(0, 0, 0, 0)
      return d
    }
    function fmt(t: Date) {
      const diff = t.getTime() - Date.now()
      if (diff <= 0) return 'Scores updating…'
      const d = Math.floor(diff / 86_400_000)
      const h = Math.floor((diff % 86_400_000) / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      if (d > 0) return `${d}d ${h}h ${m}m`
      if (h > 0) return `${h}h ${m}m ${s}s`
      return `${m}m ${s}s`
    }
    const tick = () => setScoreCountdown(fmt(nextFriday()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  const [copied, setCopied] = useState(false)
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({})
  const [myVote, setMyVote] = useState<'agreed' | 'disagreed' | null>(null)
  const [voteLoading, setVoteLoading] = useState(false)

  // Edit form state
  const [editBrandName, setEditBrandName] = useState('')
  const [editTagline, setEditTagline] = useState('')
  const [editAvatarUrl, setEditAvatarUrl] = useState('')
  const [editLogoUrl, setEditLogoUrl] = useState('')
  const [editInterests, setEditInterests] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const INTERESTS = ['Tech', 'Energy', 'Crypto', 'Healthcare', 'Finance', 'Macro', 'Consumer', 'Real Estate', 'Commodities', 'Options', 'ETFs', 'AI & Robotics', 'Biotech', 'Semiconductors', 'EV & Clean Energy']

  useEffect(() => {
    loadBrand()
    // Fire-and-forget: resolve any expired predictions, then refresh if anything changed
    fetch('/api/resolve')
      .then(r => r.json())
      .then(data => { if (data.resolved > 0) loadBrand() })
      .catch(() => {})
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
      setEditInterests((p as BrandProfile).interests ?? [])
    }

    const { data: preds } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (preds) {
      setPredictions(preds)
      // Fetch company names from jump_cards for all prediction tickers
      const tickers = [...new Set(preds.map((p: Prediction) => p.ticker))]
      if (tickers.length) {
        const { data: cards } = await supabase
          .from('jump_cards')
          .select('ticker, company_name')
          .in('ticker', tickers)
        if (cards) {
          const nameMap: Record<string, string> = {}
          for (const c of cards) if (c.company_name) nameMap[c.ticker] = c.company_name
          setCompanyNames(nameMap)
        }
      }
    }

    const { data: postsData } = await supabase
      .from('posts')
      .select('id, ticker, caption, stance, created_at, bull_votes, bear_votes, view_count, videos:post_videos(id, public_url, clip_order, duration_seconds, media_type), comments(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)
    if (postsData) setPosts(postsData.map((p: Record<string, unknown>) => ({
      ...p,
      comment_count: (p.comments as { count: number }[] | null)?.[0]?.count ?? 0,
    })) as Post[])

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

  async function handleDeletePost(postId: string) {
    setDeletingPostId(postId)
    setPostMenuId(null)
    await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
    setPosts(prev => prev.filter(p => p.id !== postId))
    setDeletingPostId(null)
  }

  function openEditPost(post: Post) {
    setEditingPost(post)
    setEditCaption(post.caption ?? '')
    setEditStance((post.stance as 'bullish' | 'bearish' | 'neutral') ?? 'neutral')
    setPostMenuId(null)
  }

  async function handleSavePost() {
    if (!editingPost) return
    setSavingPost(true)
    const res = await fetch(`/api/posts/${editingPost.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: editCaption.trim() || null, stance: editStance }),
    })
    if (res.ok) {
      setPosts(prev => prev.map(p =>
        p.id === editingPost.id ? { ...p, caption: editCaption.trim() || null, stance: editStance } : p
      ))
      setEditingPost(null)
    }
    setSavingPost(false)
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
    const updates: Record<string, string | string[] | null> = {
      brand_name: editBrandName.trim() || null,
      brand_tagline: editTagline.trim() || null,
      brand_avatar_url: editAvatarUrl.trim() || null,
      brand_logo_url: editLogoUrl.trim() || null,
      interests: editInterests,
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

  if (!profile && !loading) return null

  // ── Ticker detail view (signals + news + deep dive for a past move) ──────────
  if (!profile) return null

  if (openTicker) {
    const { ticker, prediction, price } = openTicker
    const isBull = prediction === 'bullish'
    return (
      <TickerDetailView
        ticker={ticker}
        contextBadge={
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: isBull ? 'rgba(0,200,5,0.12)' : 'rgba(255,59,48,0.12)',
              color: isBull ? '#00C805' : '#FF3B30',
              border: `1px solid ${isBull ? 'rgba(0,200,5,0.25)' : 'rgba(255,59,48,0.25)'}`,
            }}
          >
            {isBull ? '🐂 Bull' : '🐻 Bear'} · called @ ${price.toFixed(2)}
          </span>
        }
        onClose={() => setOpenTicker(null)}
      />
    )
  }

  // ── Weekly scoring helpers ───────────────────────────────────────────────────
  function nextFriday(): Date {
    const now = new Date()
    const day = now.getUTCDay()
    const daysAway = (5 - day + 7) % 7 || 7
    const d = new Date(now)
    d.setUTCDate(now.getUTCDate() + daysAway)
    d.setUTCHours(0, 0, 0, 0)
    return d
  }

  function startOfWeek(): Date {
    const now = new Date()
    const day = now.getUTCDay()
    const daysSinceFri = (day - 5 + 7) % 7
    const d = new Date(now)
    d.setUTCDate(now.getUTCDate() - daysSinceFri)
    d.setUTCHours(0, 0, 0, 0)
    return d
  }

  // Points earned/lost from resolved predictions this week
  const weekStart = startOfWeek()
  const thisWeekResolved = predictions.filter(p =>
    p.resolved && p.result && new Date(p.resolution_date ?? p.created_at) >= weekStart
  )
  const weekPoints = thisWeekResolved.reduce((sum, p) =>
    sum + (p.result === 'correct' ? 50 : -20), 0
  )
  const weekCorrect   = thisWeekResolved.filter(p => p.result === 'correct').length
  const weekIncorrect = thisWeekResolved.filter(p => p.result === 'incorrect').length

  const streak = computeStreak(predictions)
  const liveMoves = predictions.filter(p => !p.resolved)
  const moveHistory = predictions.filter(p => p.resolved)
  const bestMove = moveHistory.find(p => p.result === 'correct') ?? null
  const worstMove = moveHistory.find(p => p.result === 'incorrect') ?? null
  const displayName = profile.brand_name || profile.username
  const totalVotes = (profile.agreed_count || 0) + (profile.disagreed_count || 0)
  const agreedPct = totalVotes > 0 ? Math.round((profile.agreed_count / totalVotes) * 100) : 0

  // While loading with no profile yet, show skeleton
  if (loading && !profile) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-5 pt-5 space-y-4">
          {/* Avatar + name skeleton */}
          <div className="flex items-center gap-4 pb-4 border-b border-[#C9A84C]/10">
            <div className="w-20 h-20 rounded-full bg-[#1e2d4a] animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-[#1e2d4a] rounded animate-pulse w-1/2" />
              <div className="h-3 bg-[#1e2d4a] rounded animate-pulse w-3/4" />
            </div>
          </div>
          {/* Stats grid skeleton */}
          <div className="grid grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-14 bg-[#1e2d4a] rounded-xl animate-pulse" />
            ))}
          </div>
          {/* Tabs skeleton */}
          <div className="h-10 bg-[#1e2d4a] rounded-xl animate-pulse" />
          {/* Move rows skeleton */}
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-[#1e2d4a] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div ref={ptr.scrollRef} className="flex-1 overflow-y-auto" {...ptr.touchHandlers}>
        <PullIndicator pullDistance={ptr.pullDistance} refreshing={ptr.refreshing} />
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
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Brand Score', value: profile.market_score.toLocaleString(), color: '#C9A84C' },
              { label: 'Accuracy', value: `${profile.accuracy?.toFixed(1)}%`, color: '#00C805' },
              { label: 'Total Moves', value: profile.total_predictions, color: 'white' },
              { label: 'Agreed By', value: profile.agreed_count, sub: '⚡ Weighted', color: '#C9A84C' },
              {
                label: 'Best Move',
                value: bestMove ? `${bestMove.ticker} ${bestMove.prediction === 'bullish' ? '▲' : '▼'} ✓` : '—',
                color: bestMove ? '#00C805' : '#6b7280',
              },
              { label: 'Correct', value: `${profile.correct_predictions}/${profile.total_predictions}`, color: '#00C805' },
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

          {/* Tappable Audience + Following row */}
          <div className="flex gap-4 mt-2 mb-1">
            <button
              onClick={() => router.push(`/profile/${profile.id}/followers`)}
              className="text-center"
            >
              <div className="text-white font-black text-sm">{profile.followers}</div>
              <div className="text-[#6b7280] text-[10px] uppercase tracking-wider">Audience</div>
            </button>
            <div className="w-px bg-[#2a2a3a]" />
            <button
              onClick={() => router.push(`/profile/${profile.id}/following`)}
              className="text-center"
            >
              <div className="text-white font-black text-sm">{profile.following}</div>
              <div className="text-[#6b7280] text-[10px] uppercase tracking-wider">Following</div>
            </button>
          </div>
        </div>

        {/* C. Weekly Score Update Card */}
        <div className="px-5 py-3 border-b border-[#C9A84C]/10">
          <div
            className="rounded-2xl p-4 border border-[#C9A84C]/25 flex items-center gap-4"
            style={{ background: 'rgba(201,168,76,0.06)' }}
          >
            {/* Countdown */}
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-base">⚡</span>
                <span className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider">Score Update</span>
              </div>
              <div className="text-white font-black text-lg tabular-nums leading-none">{scoreCountdown}</div>
              <div className="text-[#6b7280] text-[10px] mt-1">Scores lock every Friday</div>
            </div>

            {/* This week's activity */}
            <div className="text-right">
              {thisWeekResolved.length === 0 ? (
                <div>
                  <div className="text-[#6b7280] font-bold text-sm">No calls yet</div>
                  <div className="text-[#4b5563] text-[10px]">this week</div>
                </div>
              ) : (
                <div>
                  <div
                    className="font-black text-xl tabular-nums"
                    style={{ color: weekPoints >= 0 ? '#00C805' : '#FF3B30' }}
                  >
                    {weekPoints >= 0 ? '+' : ''}{weekPoints} pts
                  </div>
                  <div className="text-[#6b7280] text-[10px] mt-0.5">
                    {weekCorrect}✓ {weekIncorrect > 0 ? `${weekIncorrect}✗ ` : ''}this week
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* D. Agreed By / Social Proof */}
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
                <button
                  key={pred.id}
                  onClick={() => setOpenTicker({ ticker: pred.ticker, prediction: pred.prediction, price: pred.price_at_prediction ?? 0 })}
                  className="w-full bg-[rgba(8,12,20,0.88)] rounded-xl border border-[#C9A84C]/20 p-3 flex items-center justify-between backdrop-blur-md active:scale-[0.98] transition-transform"
                >
                  <div className="text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full bg-[#1B3066]/60 text-[#C9A84C] text-xs font-black">
                        {pred.ticker}
                      </span>
                      {companyNames[pred.ticker] && (
                        <span className="text-[#6b7280] text-xs truncate max-w-[100px]">{companyNames[pred.ticker]}</span>
                      )}
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
                  <div className="flex items-center gap-2">
                    <span className="text-[#6b7280] text-xs bg-[#1a1a26] px-2 py-1 rounded-lg">⏳ Pending</span>
                    <svg className="w-4 h-4 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
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
                      {companyNames[bestMove.ticker] && <div className="text-[#6b7280] text-[10px] truncate">{companyNames[bestMove.ticker]}</div>}
                      <div className="text-[#00C805] text-xs">
                        {bestMove.prediction === 'bullish' ? '🐂 Bull' : '🐻 Bear'} ✓
                      </div>
                    </div>
                  )}
                  {worstMove && (
                    <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-xl p-3">
                      <div className="text-[#FF3B30] text-[10px] font-bold uppercase tracking-wider mb-1">Worst Move</div>
                      <div className="text-white font-black">{worstMove.ticker}</div>
                      {companyNames[worstMove.ticker] && <div className="text-[#6b7280] text-[10px] truncate">{companyNames[worstMove.ticker]}</div>}
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
                <button
                  key={pred.id}
                  onClick={() => setOpenTicker({ ticker: pred.ticker, prediction: pred.prediction, price: pred.price_at_prediction ?? 0 })}
                  className="w-full bg-[rgba(8,12,20,0.88)] rounded-xl border border-[#C9A84C]/20 p-3 flex items-center justify-between backdrop-blur-md active:scale-[0.98] transition-transform"
                >
                  <div className="text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full bg-[#1B3066]/60 text-[#C9A84C] text-xs font-black">
                        {pred.ticker}
                      </span>
                      {companyNames[pred.ticker] && (
                        <span className="text-[#6b7280] text-xs truncate max-w-[100px]">{companyNames[pred.ticker]}</span>
                      )}
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
                  <div className="flex items-center gap-2">
                    {pred.result === 'correct' ? (
                      <span className="text-[#00C805] text-xs bg-[#00C805]/10 px-2 py-1 rounded-lg">✓ Correct</span>
                    ) : pred.result === 'incorrect' ? (
                      <span className="text-[#FF3B30] text-xs bg-[#FF3B30]/10 px-2 py-1 rounded-lg">✗ Wrong</span>
                    ) : (
                      <span className="text-[#6b7280] text-xs bg-[#1a1a26] px-2 py-1 rounded-lg">⏳ Pending</span>
                    )}
                    <svg className="w-4 h-4 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
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
                  className="relative bg-[rgba(8,12,20,0.88)] rounded-xl border border-[#C9A84C]/20 p-3 backdrop-blur-md active:scale-[0.98] transition-transform cursor-pointer"
                  onClick={() => { setViewingPost(post); setViewClipIndex(0) }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5 flex-1 min-w-0">
                      {post.ticker !== 'GENERAL' && (
                        <span className="px-2 py-0.5 rounded-full bg-[#1B3066]/60 text-[#C9A84C] text-xs font-black">
                          {post.ticker}
                        </span>
                      )}
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
                      {(post.comment_count ?? 0) > 0 && (
                        <span className="flex items-center gap-0.5 text-[#6b7280] text-[10px]">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          {post.comment_count}
                        </span>
                      )}
                    </div>

                    {/* ··· menu button */}
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); setPostMenuId(postMenuId === post.id ? null : post.id) }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b7280] hover:text-white hover:bg-[#1e2d4a] transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                        </svg>
                      </button>

                      {postMenuId === post.id && (
                        <div
                          className="absolute right-0 top-8 rounded-xl overflow-hidden z-20 shadow-xl"
                          style={{ background: 'rgba(13,20,34,0.98)', border: '1px solid rgba(30,45,74,0.9)', minWidth: '130px' }}
                        >
                          <button
                            onClick={e => { e.stopPropagation(); openEditPost(post) }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-[#1e2d4a] transition-colors text-left"
                          >
                            <svg className="w-3.5 h-3.5 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit Post
                          </button>
                          <div className="border-t border-[#1e2d4a]" />
                          <button
                            onClick={e => { e.stopPropagation(); setPostMenuId(null); setConfirmDeleteId(post.id) }}
                            disabled={deletingPostId === post.id}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-colors text-left disabled:opacity-50"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            {deletingPostId === post.id ? 'Deleting…' : 'Delete Post'}
                          </button>
                        </div>
                      )}
                    </div>
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

      {/* ── Full Post Viewer ── */}
      {viewingPost && (() => {
        const vp = viewingPost
        const clips = [...(vp.videos ?? [])].sort((a, b) => a.clip_order - b.clip_order)
        const clip = clips[viewClipIndex]
        const bull = vp.bull_votes + vp.bear_votes > 0
          ? Math.round((vp.bull_votes / (vp.bull_votes + vp.bear_votes)) * 100)
          : 50
        const isUp = vp.stance === 'bullish'
        const isDown = vp.stance === 'bearish'

        return (
          <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: '#080c14' }}>
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 border-b border-[#1e2d4a] flex-shrink-0"
              style={{ paddingTop: 'max(20px, env(safe-area-inset-top))', paddingBottom: '12px' }}
            >
              <button onClick={() => setViewingPost(null)} className="flex items-center gap-1.5 text-[#6b7280]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-bold">Back</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { openEditPost(vp); setViewingPost(null) }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-[#C9A84C]/40 text-[#C9A84C]"
                  style={{ background: 'rgba(201,168,76,0.08)' }}
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => { setViewingPost(null); setConfirmDeleteId(vp.id) }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-[#FF3B30]/30 text-[#FF3B30]"
                  style={{ background: 'rgba(255,59,48,0.08)' }}
                >
                  🗑 Delete
                </button>
              </div>
            </div>

            {/* Media area — capped at 55vh so info section is always visible */}
            <div className="relative bg-black flex-shrink-0" style={{ height: '55vh' }}>
              {clip ? (
                clip.media_type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={clip.public_url} className="w-full h-full object-contain" alt="Post" />
                ) : (
                  <video
                    src={clip.public_url}
                    className="w-full h-full object-contain"
                    playsInline
                    controls
                    preload="metadata"
                  />
                )
              ) : (
                /* Text-only post */
                <div className="w-full h-full flex items-center justify-center px-8">
                  <div className="text-center">
                    <div className="text-5xl mb-4">
                      {isUp ? '🐂' : isDown ? '🐻' : '⚖️'}
                    </div>
                    <p className="text-white text-xl font-bold leading-relaxed">{vp.caption}</p>
                  </div>
                </div>
              )}

              {/* Clip progress bar */}
              {clips.length > 1 && (
                <div className="absolute top-3 left-3 right-3 flex gap-1">
                  {clips.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setViewClipIndex(i)}
                      className="flex-1 h-0.5 rounded-full"
                      style={{ background: i === viewClipIndex ? '#fff' : 'rgba(255,255,255,0.3)' }}
                    />
                  ))}
                </div>
              )}

              {/* Tap zones for clip navigation */}
              {clips.length > 1 && (
                <>
                  <button className="absolute left-0 top-0 bottom-0 w-1/3" onClick={() => setViewClipIndex(i => Math.max(0, i - 1))} />
                  <button className="absolute right-0 top-0 bottom-0 w-1/3" onClick={() => setViewClipIndex(i => Math.min(clips.length - 1, i + 1))} />
                </>
              )}

              {/* Stance badge */}
              <div className="absolute left-3" style={{ top: clips.length > 1 ? '28px' : '12px' }}>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  isUp ? 'bg-[#00C805]/20 text-[#00C805] border border-[#00C805]/40' :
                  isDown ? 'bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/40' :
                  'bg-white/10 text-white border border-white/20'
                }`}>
                  {isUp ? '🐂 Bullish' : isDown ? '🐻 Bearish' : '⚖️ Neutral'}
                </span>
              </div>

              {/* Ticker */}
              {vp.ticker && vp.ticker !== 'GENERAL' && (
                <div className="absolute right-3" style={{ top: clips.length > 1 ? '28px' : '12px' }}>
                  <span className="text-[#C9A84C] font-black text-lg">${vp.ticker}</span>
                </div>
              )}

              {/* Clip counter */}
              {clips.length > 1 && (
                <div className="absolute bottom-3 right-3 bg-black/60 rounded-full px-2 py-0.5 text-[10px] text-white font-mono">
                  {viewClipIndex + 1}/{clips.length}
                </div>
              )}
            </div>

            {/* Info section — scrollable, always visible */}
            <div className="flex-1 overflow-y-auto border-t border-[#1e2d4a]"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>

              {/* Caption */}
              {vp.caption && clip && (
                <p className="text-white text-sm leading-relaxed px-4 pt-4 pb-2">{vp.caption}</p>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-3 px-4 py-2 text-xs text-[#6b7280]">
                <span>{new Date(vp.created_at).toLocaleDateString()}</span>
                <span>·</span>
                <span>{vp.view_count} views</span>
                {clips.length > 1 && <span>· {clips.length} clips</span>}
                {(vp.comment_count ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {vp.comment_count} comment{vp.comment_count !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Sentiment bar */}
              <div className="flex items-center gap-2 px-4 py-3">
                <span className="text-[#00C805] text-xs font-bold">🐂 {bull}%</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-[#FF3B30]/30">
                  <div className="h-full bg-[#00C805] rounded-full" style={{ width: `${bull}%` }} />
                </div>
                <span className="text-[#FF3B30] text-xs font-bold">{100 - bull}% 🐻</span>
              </div>

              {/* Divider */}
              <div className="mx-4 border-t border-[#1e2d4a] my-1" />

              {/* Stance + ticker summary */}
              <div className="flex items-center gap-3 px-4 py-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  isUp ? 'bg-[#00C805]/15 text-[#00C805]' :
                  isDown ? 'bg-[#FF3B30]/15 text-[#FF3B30]' :
                  'bg-white/10 text-[#9ca3af]'
                }`}>
                  {isUp ? '🐂 Bullish' : isDown ? '🐻 Bearish' : '⚖️ Neutral'}
                </span>
                {vp.ticker && vp.ticker !== 'GENERAL' && (
                  <span className="text-[#C9A84C] font-black text-sm">${vp.ticker}</span>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Dismiss menu on outside tap */}
      {postMenuId && (
        <div className="fixed inset-0 z-10" onClick={() => setPostMenuId(null)} />
      )}

      {/* Edit Post modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div
            className="w-full rounded-t-3xl border-t border-[#C9A84C]/20 p-6"
            style={{ background: 'rgba(8,12,20,0.97)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-black text-base">Edit Post</h2>
              <button onClick={() => setEditingPost(null)} className="text-[#6b7280]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Caption */}
            <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-1.5 block">Caption</label>
            <textarea
              value={editCaption}
              onChange={e => setEditCaption(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full bg-[#12121a] border border-[#C9A84C]/20 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#C9A84C]/60 resize-none mb-4"
              placeholder="What's your market take?"
            />

            {/* Stance */}
            <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-2 block">Stance</label>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {(['bullish', 'neutral', 'bearish'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setEditStance(s)}
                  className="py-2.5 rounded-xl border text-xs font-black transition-all"
                  style={{
                    background: editStance === s
                      ? s === 'bullish' ? 'rgba(0,200,5,0.15)' : s === 'bearish' ? 'rgba(255,59,48,0.15)' : 'rgba(201,168,76,0.1)'
                      : 'rgba(8,12,20,0.6)',
                    borderColor: editStance === s
                      ? s === 'bullish' ? 'rgba(0,200,5,0.5)' : s === 'bearish' ? 'rgba(255,59,48,0.5)' : 'rgba(201,168,76,0.4)'
                      : 'rgba(30,45,74,0.8)',
                    color: editStance === s
                      ? s === 'bullish' ? '#00C805' : s === 'bearish' ? '#FF3B30' : '#C9A84C'
                      : '#6b7280',
                  }}
                >
                  {s === 'bullish' ? '🐂 Bull' : s === 'bearish' ? '🐻 Bear' : '⚖️ Neutral'}
                </button>
              ))}
            </div>

            <button
              onClick={handleSavePost}
              disabled={savingPost}
              className="w-full py-3.5 rounded-xl font-black text-sm text-black disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96d)' }}
            >
              {savingPost ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm sheet */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-end"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="w-full max-w-lg px-5 pb-10 pt-6 flex flex-col gap-3 rounded-t-3xl"
            style={{ background: '#0d1422', borderTop: '1px solid rgba(201,168,76,0.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-white font-bold text-center text-base">Delete this post?</p>
            <p className="text-[#6b7280] text-xs text-center">This can&apos;t be undone.</p>
            <button
              onClick={() => { handleDeletePost(confirmDeleteId); setConfirmDeleteId(null) }}
              disabled={!!deletingPostId}
              className="w-full py-3 rounded-2xl font-black text-white text-sm active:scale-95 transition-all disabled:opacity-50"
              style={{ background: '#FF3B30' }}
            >
              {deletingPostId ? 'Deleting…' : 'Yes, Delete'}
            </button>
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="w-full py-3 rounded-2xl font-bold text-[#6b7280] text-sm active:scale-95 transition-all"
              style={{ background: 'rgba(30,45,74,0.6)', border: '1px solid rgba(30,45,74,0.8)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit Brand slide-up modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div
            className="rounded-t-3xl border-t border-[#C9A84C]/20 backdrop-blur-md overflow-y-auto max-h-[85vh]"
            style={{ background: 'rgba(8,12,20,0.97)' }}
          >
            <div className="p-6">
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

                {/* Interests */}
                <div>
                  <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-2 block">Interests</label>
                  <div className="flex flex-wrap gap-2">
                    {INTERESTS.map(interest => {
                      const selected = editInterests.includes(interest)
                      return (
                        <button
                          key={interest}
                          type="button"
                          onClick={() => setEditInterests(prev =>
                            prev.includes(interest)
                              ? prev.filter(i => i !== interest)
                              : [...prev, interest]
                          )}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                            selected
                              ? 'border-[#C9A84C] text-[#C9A84C]'
                              : 'border-[#2a2a3a] text-[#6b7280] bg-[#12121a]'
                          }`}
                          style={selected ? { background: 'rgba(201,168,76,0.15)' } : {}}
                        >
                          {interest}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="pb-8">
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
          </div>
        </div>
      )}
    </div>
  )
}
