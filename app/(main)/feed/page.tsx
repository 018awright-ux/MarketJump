'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { JumpCard as JumpCardType, VideoPost, UserLevel } from '@/lib/types'
import JumpCard from '@/components/JumpCard'
import VideoCard from '@/components/VideoCard'
import ExpandedCard from '@/components/ExpandedCard'
import CreatePost from '@/components/CreatePost'
import CommentsSheet from '@/components/CommentsSheet'

type FeedItem =
  | { kind: 'card'; data: JumpCardType }
  | { kind: 'video'; data: VideoPost }

type FeedFilter =
  | 'all'
  | 'creators'
  | 'articles'
  | 'recent'
  | 'trending'
  | 'discovery'
  | 'top_stocks'
  | 'commented'
  | 'bullish'
  | 'bearish'

const FILTERS: { id: FeedFilter; label: string; emoji: string }[] = [
  { id: 'all',        label: 'All',         emoji: '⚡' },
  { id: 'creators',   label: 'Creators',    emoji: '🎬' },
  { id: 'articles',   label: 'Articles',    emoji: '📰' },
  { id: 'recent',     label: 'Recent',      emoji: '🕐' },
  { id: 'trending',   label: 'Trending',    emoji: '🔥' },
  { id: 'discovery',  label: 'Discovery',   emoji: '🔭' },
  { id: 'top_stocks', label: 'Top Stocks',  emoji: '📈' },
  { id: 'commented',  label: 'Discussed',   emoji: '💬' },
  { id: 'bullish',    label: 'Bullish',     emoji: '🐂' },
  { id: 'bearish',    label: 'Bearish',     emoji: '🐻' },
]

const FEED_CACHE_TTL = 10 * 60 * 1000 // 10 minutes
const FILTER_STORAGE_KEY = 'mj_feed_filter'

function cacheKey(filter: FeedFilter) { return `mj_feed_cache_${filter}` }

interface FeedCache { items: FeedItem[]; index: number; history: number[]; ts: number }

function readCache(filter: FeedFilter): FeedCache | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(filter))
    if (!raw) return null
    const c: FeedCache = JSON.parse(raw)
    if (Date.now() - c.ts > FEED_CACHE_TTL) return null
    if (!c.items?.length) return null
    return c
  } catch { return null }
}

function writeCache(filter: FeedFilter, items: FeedItem[], index: number, history: number[]) {
  try {
    sessionStorage.setItem(cacheKey(filter), JSON.stringify({ items, index, history, ts: Date.now() }))
  } catch {}
}

function getSavedFilter(): FeedFilter {
  try { return (sessionStorage.getItem(FILTER_STORAGE_KEY) as FeedFilter) ?? 'all' }
  catch { return 'all' }
}

export default function FeedPage() {
  // Read filter synchronously so it's available to all lazy initialisers
  const initialFilter = getSavedFilter()

  // Lazy-init from cache — no spinner flash, no race condition
  const [activeFilter, setActiveFilter] = useState<FeedFilter>(initialFilter)
  const [feed, setFeed] = useState<FeedItem[]>(() => readCache(initialFilter)?.items ?? [])
  const [index, setIndex] = useState<number>(() => {
    const c = readCache(initialFilter)
    return c ? Math.min(c.index, c.items.length - 1) : 0
  })
  const [history, setHistory] = useState<number[]>(() => readCache(initialFilter)?.history ?? [])
  const [tracked, setTracked] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState(false)
  const [autoMode, setAutoMode] = useState(false)
  const [level, setLevel] = useState<UserLevel>('rookie')
  const [userId, setUserId] = useState<string | null>(null)
  const [actionFlash, setActionFlash] = useState<'bull' | 'bear' | null>(null)
  const [loading, setLoading] = useState<boolean>(() => !readCache(initialFilter))
  const [refreshing, setRefreshing] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showComments, setShowComments] = useState(false)
  // Tracks comments added this session for any feed item (both cards and videos)
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})

  // Pull-to-refresh touch tracking
  const touchStartY = useRef(0)
  const [pullDistance, setPullDistance] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const filterBarRef = useRef<HTMLDivElement>(null)

  // Keep a ref of activeFilter so loadFeed closures don't go stale
  const activeFilterRef = useRef<FeedFilter>(initialFilter)
  useEffect(() => { activeFilterRef.current = activeFilter }, [activeFilter])

  // Keep a ref of current index so callbacks (like onCommentPosted) never read stale index
  const indexRef = useRef(index)
  useEffect(() => { indexRef.current = index }, [index])

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('level').eq('id', user.id).single()
        if (profile) setLevel(profile.level as UserLevel)
        const { data: wl } = await supabase.from('watchlist').select('ticker').eq('user_id', user.id)
        if (wl) setTracked(new Set(wl.map((w: { ticker: string }) => w.ticker)))
      }

      if (!readCache(activeFilterRef.current)) {
        await loadFeed(false, activeFilterRef.current)
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadFeed(isRefresh = true, filter: FeedFilter = activeFilterRef.current) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    // Which sources to fetch per filter
    const wantCards = filter !== 'creators'
    const wantPosts = filter === 'all' || filter === 'recent' || filter === 'creators' || filter === 'commented'

    try {
      const [cardsRes, postsRes] = await Promise.all([
        wantCards
          ? fetch(`/api/feed?filter=${filter}`)
          : Promise.resolve(null),
        wantPosts
          ? fetch('/api/posts')
          : Promise.resolve(null),
      ])

      const [cardsData, postsData] = await Promise.all([
        cardsRes ? cardsRes.json() : { cards: [] },
        postsRes ? postsRes.json() : { posts: [] },
      ])

      const cards: FeedItem[] = (cardsData.cards ?? []).map((c: JumpCardType) => ({ kind: 'card' as const, data: c }))
      const videos: FeedItem[] = (postsData.posts ?? []).map((p: VideoPost) => ({ kind: 'video' as const, data: p }))

      let merged: FeedItem[]
      if (filter === 'creators') {
        merged = videos
      } else if (!wantPosts || videos.length === 0) {
        merged = cards
      } else {
        // Interleave: every 3 cards, insert a video
        merged = []
        let vi = 0
        for (let ci = 0; ci < cards.length; ci++) {
          merged.push(cards[ci])
          if ((ci + 1) % 3 === 0 && vi < videos.length) merged.push(videos[vi++])
        }
        while (vi < videos.length) merged.push(videos[vi++])
      }

      const final = merged.length ? merged : cards
      setFeed(final)
      writeCache(filter, final, 0, [])
      if (isRefresh) { setIndex(0); setHistory([]) }
    } catch { /* silent */ }

    if (isRefresh) setRefreshing(false)
    else setLoading(false)
  }

  // Persist position + history whenever anything changes
  useEffect(() => {
    if (feed.length > 0) writeCache(activeFilter, feed, index, history)
  }, [index, feed, activeFilter, history])

  // Scroll active filter chip into view
  useEffect(() => {
    const bar = filterBarRef.current
    if (!bar) return
    const chip = bar.querySelector(`[data-filter="${activeFilter}"]`) as HTMLElement | null
    if (chip) chip.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
  }, [activeFilter])

  function handleFilterChange(newFilter: FeedFilter) {
    if (newFilter === activeFilter) return
    setActiveFilter(newFilter)
    activeFilterRef.current = newFilter
    try { sessionStorage.setItem(FILTER_STORAGE_KEY, newFilter) } catch {}
    setHistory([])
    setExpanded(false)

    const cached = readCache(newFilter)
    if (cached) {
      setFeed(cached.items)
      setIndex(Math.min(cached.index, cached.items.length - 1))
      setHistory(cached.history ?? [])
      setLoading(false)
    } else {
      setFeed([])
      setIndex(0)
      setHistory([])
      loadFeed(false, newFilter)
    }
  }

  const currentItem = feed[index]
  const currentTicker = currentItem?.data?.ticker ?? ''

  const advance = useCallback(() => {
    setExpanded(false)
    setIndex(i => {
      setHistory(h => [...h.slice(-20), i])
      if (i < feed.length - 1) return i + 1
      loadFeed(true, activeFilterRef.current)
      return 0
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.length])

  function goBack() {
    setExpanded(false)
    setHistory(h => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setIndex(prev)
      return h.slice(0, -1)
    })
  }

  useEffect(() => {
    if (!autoMode) return
    const timer = setTimeout(advance, 5000)
    return () => clearTimeout(timer)
  }, [autoMode, index, advance])

  async function handlePrediction(prediction: 'bullish' | 'bearish') {
    if (!userId || !currentItem) return
    setActionFlash(prediction === 'bullish' ? 'bull' : 'bear')
    setTimeout(() => setActionFlash(null), 600)

    const ticker = currentItem.data.ticker
    const price = currentItem.kind === 'card' ? (currentItem.data.price ?? 0) : 0

    const calls: Promise<unknown>[] = [
      fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, prediction, price }),
      }),
    ]
    if (currentItem.kind === 'card' && currentItem.data.id) {
      calls.push(fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: currentItem.data.id, vote: prediction }),
      }))
    }
    await Promise.allSettled(calls)
    advance()
  }

  async function handleVote(postId: string, vote: 'bullish' | 'bearish') {
    if (!userId) return
    const supabase = createClient()
    await supabase.from('post_votes').upsert({ user_id: userId, post_id: postId, vote })
  }

  async function handleTrack() {
    if (!userId || !currentItem) return
    const supabase = createClient()
    const ticker = currentItem.data.ticker
    if (tracked.has(ticker)) {
      await supabase.from('watchlist').delete().eq('user_id', userId).eq('ticker', ticker)
      setTracked(prev => { const n = new Set(prev); n.delete(ticker); return n })
    } else {
      await supabase.from('watchlist').insert({ user_id: userId, ticker })
      setTracked(prev => new Set([...prev, ticker]))
    }
  }

  // Pull-to-refresh handlers
  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
  }
  function handleTouchMove(e: React.TouchEvent) {
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0 && !refreshing) setPullDistance(Math.min(dy, 80))
  }
  function handleTouchEnd() {
    if (pullDistance > 60) loadFeed(true, activeFilterRef.current)
    setPullDistance(0)
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl font-black mb-2">
            <span className="text-[#C9A84C]">Market</span><span className="text-white">Jump</span>
          </div>
          <div className="text-[#6b7280] text-sm animate-pulse">Loading feed...</div>
        </div>
      </div>
    )
  }

  if (!currentItem) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">📭</div>
          <h2 className="text-white font-bold text-xl mb-2">Nothing here yet</h2>
          <p className="text-[#6b7280] text-sm mb-6">
            {activeFilter === 'creators' ? 'No creator posts yet. Be the first!' : 'Check back soon for new market moves.'}
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => loadFeed(true, activeFilter)} className="bg-[#00C805] text-black font-bold px-6 py-3 rounded-xl">
              Refresh
            </button>
            {activeFilter !== 'all' && (
              <button onClick={() => handleFilterChange('all')} className="bg-[#1e2d4a] text-white font-bold px-6 py-3 rounded-xl">
                Show All
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const isTracked = tracked.has(currentTicker)

  return (
    <>
      <div
        className="relative h-full flex flex-col"
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        {(pullDistance > 0 || refreshing) && (
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-center z-30 transition-all pointer-events-none"
            style={{ height: refreshing ? 40 : pullDistance * 0.5, opacity: refreshing ? 1 : pullDistance / 60 }}
          >
            <div className={`w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full ${refreshing ? 'animate-spin' : ''}`} />
          </div>
        )}

        {/* Action flash */}
        {actionFlash && (
          <div className={`absolute inset-0 pointer-events-none z-20 flex items-center justify-center
            ${actionFlash === 'bull' ? 'bg-[#00C805]/10' : 'bg-[#FF3B30]/10'}`}>
            <span className={`text-6xl font-black opacity-80 ${actionFlash === 'bull' ? 'animate-pulse-bull' : 'animate-pulse-bear'}`}>
              {actionFlash === 'bull' ? '🐂' : '🐻'}
            </span>
          </div>
        )}

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
          <div className="text-lg font-black tracking-tight">
            <span className="text-[#C9A84C]">Market</span><span className="text-white">Jump</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border border-[#C9A84C]/30 text-[#C9A84C]"
              style={{ background: 'rgba(201,168,76,0.08)' }}
            >
              <span className="text-sm leading-none">+</span> Post
            </button>
            <span className="text-[#6b7280] text-xs font-mono">{index + 1}/{feed.length}</span>
            <button
              onClick={() => setAutoMode(a => !a)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors border ${
                autoMode ? 'border-[#C9A84C]/40 text-[#C9A84C]' : 'border-[#1e2d4a] text-[#6b7280]'
              }`}
              style={{ background: autoMode ? 'rgba(201,168,76,0.1)' : 'rgba(8,12,20,0.6)' }}
            >
              {autoMode ? '⚡ Auto' : '👆 Manual'}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 mb-1 flex-shrink-0">
          <div className="w-full h-px rounded-full overflow-hidden" style={{ background: 'rgba(30,45,74,0.8)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${((index + 1) / feed.length) * 100}%`, background: '#C9A84C' }}
            />
          </div>
        </div>

        {/* ── FILTER BAR ── horizontally scrollable, no visible scrollbar */}
        <div
          ref={filterBarRef}
          className="flex-shrink-0 px-4 py-1.5 flex gap-2 overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {FILTERS.map(f => {
            const active = activeFilter === f.id
            return (
              <button
                key={f.id}
                data-filter={f.id}
                onClick={() => handleFilterChange(f.id)}
                className="flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold transition-all active:scale-95"
                style={active ? {
                  background: 'linear-gradient(135deg, #1B3066, #C9A84C)',
                  color: '#fff',
                  boxShadow: '0 0 10px rgba(201,168,76,0.3)',
                } : {
                  background: 'rgba(30,45,74,0.6)',
                  color: '#6b7280',
                  border: '1px solid rgba(30,45,74,0.8)',
                }}
              >
                <span>{f.emoji}</span>
                <span>{f.label}</span>
              </button>
            )
          })}
        </div>

        {/* ── CARD AREA — flex-1, no overflow ── */}
        <div className="flex-1 px-4 pb-1 min-h-0 flex flex-col overflow-hidden">
          {currentItem.kind === 'video' ? (
            <VideoCard
              key={currentItem.data.id}
              post={currentItem.data}
              userId={userId}
              onBullish={() => { handleVote(currentItem.data.id, 'bullish'); handlePrediction('bullish') }}
              onBearish={() => { handleVote(currentItem.data.id, 'bearish'); handlePrediction('bearish') }}
              onJump={advance}
              onDeleted={() => {
                // Remove deleted post from feed and move to next item
                setFeed(prev => {
                  const next = prev.filter((_, i) => i !== index)
                  return next
                })
                setIndex(i => Math.min(i, feed.length - 2))
                setHistory([])
              }}
            />
          ) : (
            <JumpCard
              key={currentItem.data.id}
              card={currentItem.data}
              onBullish={() => handlePrediction('bullish')}
              onBearish={() => handlePrediction('bearish')}
            />
          )}
        </div>

        {/* ── BOTTOM ACTION BAR — stationary, always visible ── */}
        <div className="px-4 pt-1 pb-2 flex-shrink-0 flex items-center justify-between">

          {/* Left side: Back + Comments */}
          <div className="flex items-center gap-2">
            <button
              onClick={goBack}
              disabled={history.length === 0}
              className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-0.5 disabled:opacity-25 transition-all active:scale-90"
              style={{ background: 'rgba(30,45,74,0.6)', border: '1px solid rgba(30,45,74,0.8)' }}
            >
              <svg className="w-4 h-4 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-[8px] font-bold text-[#6b7280]">Back</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowComments(true)}
                className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-all"
                style={{ background: 'rgba(30,45,74,0.6)', border: '1px solid rgba(30,45,74,0.8)' }}
              >
                <svg className="w-4 h-4 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="text-[8px] font-bold text-[#6b7280]">Chat</span>
              </button>
              {(() => {
                const baseCount = currentItem.kind === 'video' ? (currentItem.data.comment_count ?? 0) : 0
                const sessionCount = commentCounts[currentItem.data.id] ?? 0
                const badgeCount = baseCount + sessionCount
                return badgeCount > 0 ? (
                  <span
                    className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center text-[9px] font-black pointer-events-none"
                    style={{ background: '#C9A84C', color: '#000' }}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                ) : null
              })()}
            </div>
          </div>

          {/* Center: pulsating JUMP circle — the core feature */}
          <button
            onClick={advance}
            className="w-20 h-20 rounded-full flex flex-col items-center justify-center gap-1 active:scale-90 transition-all animate-jump-pulse"
            style={{
              background: 'linear-gradient(135deg, #1B3066 0%, #2a4a8a 50%, #C9A84C 100%)',
              color: '#fff',
              boxShadow: '0 0 28px rgba(201,168,76,0.45), 0 0 56px rgba(27,48,102,0.35)',
            }}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-[10px] font-black tracking-widest">JUMP</span>
          </button>

          {/* Right side: Track + Deep Dive */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTrack}
              className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-all"
              style={{
                background: isTracked ? 'rgba(201,168,76,0.15)' : 'rgba(30,45,74,0.6)',
                border: `1px solid ${isTracked ? 'rgba(201,168,76,0.5)' : 'rgba(30,45,74,0.8)'}`,
              }}
            >
              <span className="text-base leading-none">{isTracked ? '⭐' : '☆'}</span>
              <span className={`text-[8px] font-bold ${isTracked ? 'text-[#C9A84C]' : 'text-[#6b7280]'}`}>Track</span>
            </button>

            <button
              onClick={() => currentItem.kind === 'card' && setExpanded(true)}
              disabled={currentItem.kind !== 'card'}
              className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-all disabled:opacity-30"
              style={{ background: 'rgba(30,45,74,0.6)', border: '1px solid rgba(30,45,74,0.8)' }}
            >
              <span className="text-base leading-none">🔍</span>
              <span className="text-[8px] font-bold text-[#6b7280]">Dive</span>
            </button>
          </div>
        </div>

        {/* Expanded card modal */}
        {expanded && currentItem.kind === 'card' && (
          <ExpandedCard
            card={currentItem.data}
            level={level}
            onClose={() => setExpanded(false)}
            onBullish={() => { setExpanded(false); handlePrediction('bullish') }}
            onBearish={() => { setExpanded(false); handlePrediction('bearish') }}
            onTrack={handleTrack}
            onJump={() => { setExpanded(false); advance() }}
            tracked={isTracked}
          />
        )}
      </div>

      {/* Create Post modal */}
      {showCreate && (
        <CreatePost
          onClose={() => setShowCreate(false)}
          onPosted={async () => {
            setShowCreate(false)
            try {
              // Fetch the freshest post (the one just created) and prepend it
              const res = await fetch('/api/posts')
              const data = await res.json()
              const newest = data.posts?.[0]
              if (newest) {
                setFeed(prev => {
                  // Remove any existing copy of this post, then prepend
                  const without = prev.filter(f => !(f.kind === 'video' && f.data.id === newest.id))
                  return [{ kind: 'video' as const, data: newest }, ...without]
                })
                setIndex(0)
                setHistory([])
              } else {
                loadFeed(true, activeFilterRef.current)
              }
            } catch {
              loadFeed(true, activeFilterRef.current)
            }
          }}
        />
      )}

      {/* Comments sheet */}
      {showComments && currentItem && (
        <CommentsSheet
          postId={currentItem.kind === 'video' ? currentItem.data.id : undefined}
          cardId={currentItem.kind === 'card' ? currentItem.data.id : undefined}
          title={currentItem.kind === 'card' ? currentItem.data.ticker : currentItem.data.ticker}
          onClose={() => setShowComments(false)}
          onCommentPosted={() => {
            // Use ref so we always read the current index, never a stale closure value
            const currentIndex = indexRef.current
            const item = feed[currentIndex]
            if (!item) return
            const itemId = item.data.id
            // Track session comment count for badge (works for both cards and videos)
            setCommentCounts(prev => ({ ...prev, [itemId]: (prev[itemId] ?? 0) + 1 }))
            // Also update comment_count in feed array for video posts (persists across navigations)
            if (item.kind === 'video') {
              setFeed(prev => prev.map((fi, i): FeedItem => {
                if (i !== currentIndex || fi.kind !== 'video') return fi
                return { kind: 'video' as const, data: { ...fi.data, comment_count: (fi.data.comment_count ?? 0) + 1 } }
              }))
            }
          }}
        />
      )}
    </>
  )
}
