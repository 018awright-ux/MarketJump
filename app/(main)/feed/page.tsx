'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { JumpCard as JumpCardType, VideoPost, UserLevel } from '@/lib/types'
import JumpCard from '@/components/JumpCard'
import VideoCard from '@/components/VideoCard'
import ExpandedCard from '@/components/ExpandedCard'
import CreatePost from '@/components/CreatePost'

type FeedItem =
  | { kind: 'card'; data: JumpCardType }
  | { kind: 'video'; data: VideoPost }

export default function FeedPage() {
  const supabase = createClient()
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [index, setIndex] = useState(0)
  const [tracked, setTracked] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState(false)
  const [autoMode, setAutoMode] = useState(false)
  const [level, setLevel] = useState<UserLevel>('rookie')
  const [userId, setUserId] = useState<string | null>(null)
  const [actionFlash, setActionFlash] = useState<'bull' | 'bear' | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('level').eq('id', user.id).single()
        if (profile) setLevel(profile.level as UserLevel)
        const { data: wl } = await supabase.from('watchlist').select('ticker').eq('user_id', user.id)
        if (wl) setTracked(new Set(wl.map((w: { ticker: string }) => w.ticker)))
      }
      await loadFeed()
    }
    init()
  }, [])

  async function loadFeed() {
    setLoading(true)
    try {
      const [cardsRes, postsRes] = await Promise.all([
        fetch('/api/feed'),
        fetch('/api/posts'),
      ])
      const [cardsData, postsData] = await Promise.all([
        cardsRes.json(),
        postsRes.json(),
      ])

      const cards: FeedItem[] = (cardsData.cards ?? []).map((c: JumpCardType) => ({ kind: 'card' as const, data: c }))
      const videos: FeedItem[] = (postsData.posts ?? []).map((p: VideoPost) => ({ kind: 'video' as const, data: p }))

      // Interleave: every 3 cards, insert a video if available
      const merged: FeedItem[] = []
      let vi = 0
      for (let ci = 0; ci < cards.length; ci++) {
        merged.push(cards[ci])
        if ((ci + 1) % 3 === 0 && vi < videos.length) {
          merged.push(videos[vi++])
        }
      }
      // Append remaining videos at the end
      while (vi < videos.length) merged.push(videos[vi++])

      setFeed(merged.length ? merged : cards)
      setIndex(0)
    } catch {
      // silent fallback
    }
    setLoading(false)
  }

  const currentItem = feed[index]

  const advance = useCallback(() => {
    setExpanded(false)
    setIndex(i => {
      if (i < feed.length - 1) return i + 1
      loadFeed()
      return 0
    })
  }, [feed.length])

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

    // Fire both in parallel — prediction records the long-term call, vote updates card sentiment
    const calls: Promise<unknown>[] = [
      fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, prediction, price }),
      }),
    ]

    if (currentItem.kind === 'card' && currentItem.data.id) {
      calls.push(
        fetch('/api/votes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ card_id: currentItem.data.id, vote: prediction }),
        })
      )
    }

    await Promise.allSettled(calls)
    advance()
  }

  async function handleVote(postId: string, vote: 'bullish' | 'bearish') {
    if (!userId) return
    await supabase.from('post_votes').upsert({ user_id: userId, post_id: postId, vote })
    // Optimistic UI: refresh post data in background
  }

  async function handleTrack() {
    if (!userId || !currentItem) return
    const ticker = currentItem.data.ticker
    if (tracked.has(ticker)) {
      await supabase.from('watchlist').delete().eq('user_id', userId).eq('ticker', ticker)
      setTracked(prev => { const n = new Set(prev); n.delete(ticker); return n })
    } else {
      await supabase.from('watchlist').insert({ user_id: userId, ticker })
      setTracked(prev => new Set([...prev, ticker]))
    }
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
          <h2 className="text-white font-bold text-xl mb-2">Feed's empty</h2>
          <p className="text-[#6b7280] text-sm mb-6">Check back soon for new market moves.</p>
          <button onClick={loadFeed} className="bg-[#00C805] text-black font-bold px-6 py-3 rounded-xl">
            Refresh
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="relative h-full flex flex-col">
        {/* Action flash */}
        {actionFlash && (
          <div className={`absolute inset-0 pointer-events-none z-20 flex items-center justify-center
            ${actionFlash === 'bull' ? 'bg-[#00C805]/10' : 'bg-[#FF3B30]/10'}`}>
            <span className={`text-6xl font-black opacity-80 ${actionFlash === 'bull' ? 'animate-pulse-bull' : 'animate-pulse-bear'}`}>
              {actionFlash === 'bull' ? '🐂' : '🐻'}
            </span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <div className="text-lg font-black tracking-tight">
            <span className="text-[#C9A84C]">Market</span><span className="text-white">Jump</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Create post button */}
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
        <div className="px-5 mb-2">
          <div className="w-full h-px rounded-full overflow-hidden" style={{ background: 'rgba(30,45,74,0.8)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${((index + 1) / feed.length) * 100}%`, background: '#C9A84C' }}
            />
          </div>
        </div>

        {/* Card area */}
        <div className="flex-1 px-5 pb-3 min-h-0">
          {currentItem.kind === 'video' ? (
            <VideoCard
              key={currentItem.data.id}
              post={currentItem.data}
              onBullish={() => { handleVote(currentItem.data.id, 'bullish'); handlePrediction('bullish') }}
              onBearish={() => { handleVote(currentItem.data.id, 'bearish'); handlePrediction('bearish') }}
              onTrack={handleTrack}
              onJump={advance}
              tracked={tracked.has(currentItem.data.ticker)}
            />
          ) : (
            <JumpCard
              key={currentItem.data.id}
              card={currentItem.data}
              onBullish={() => handlePrediction('bullish')}
              onBearish={() => handlePrediction('bearish')}
              onTrack={handleTrack}
              onHold={() => setExpanded(true)}
              onJump={advance}
              tracked={tracked.has(currentItem.data.ticker)}
            />
          )}
        </div>

        {/* Expanded card modal — only for JumpCards */}
        {expanded && currentItem.kind === 'card' && (
          <ExpandedCard
            card={currentItem.data}
            level={level}
            onClose={() => setExpanded(false)}
            onBullish={() => { setExpanded(false); handlePrediction('bullish') }}
            onBearish={() => { setExpanded(false); handlePrediction('bearish') }}
            onTrack={handleTrack}
            onJump={() => { setExpanded(false); advance() }}
            tracked={tracked.has(currentItem.data.ticker)}
          />
        )}
      </div>

      {/* Create Post modal */}
      {showCreate && (
        <CreatePost
          onClose={() => setShowCreate(false)}
          onPosted={() => {
            setShowCreate(false)
            loadFeed()
          }}
        />
      )}
    </>
  )
}
