'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { JumpCard, VideoPost, UserLevel } from '@/lib/types'
import ExpandedCard from '@/components/ExpandedCard'
import CommentsSheet from '@/components/CommentsSheet'

interface NewsItem {
  id?: number
  headline: string
  summary?: string
  source: string
  url: string
  datetime: number
}

type FeedItem =
  | { kind: 'card'; data: JumpCard }
  | { kind: 'video'; data: VideoPost }

function timeAgo(unix: number): string {
  const diff = Math.floor(Date.now() / 1000) - unix
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

interface Props {
  ticker: string
  /** Optional badge shown under the ticker name (e.g. "🐂 Bullish · called at $182.50") */
  contextBadge?: React.ReactNode
  onClose: () => void
}

export default function TickerDetailView({ ticker, contextBadge, onClose }: Props) {
  const supabase = createClient()
  const [items, setItems] = useState<FeedItem[]>([])
  const [index, setIndex] = useState(0)
  const [history, setHistory] = useState<number[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingNews, setLoadingNews] = useState(true)
  const [quote, setQuote] = useState<{ c: number; dp: number } | null>(null)
  const [activeTab, setActiveTab] = useState<'signals' | 'news'>('signals')
  const [actionFlash, setActionFlash] = useState<'bull' | 'bear' | null>(null)
  const [showDeepDive, setShowDeepDive] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [commentTarget, setCommentTarget] = useState<{ url: string; title: string } | null>(null)
  const [level, setLevel] = useState<UserLevel>('rookie')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadingNews(true)

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserId(user.id)
          const { data: profile } = await supabase
            .from('profiles')
            .select('level')
            .eq('id', user.id)
            .single()
          if (profile) setLevel(profile.level as UserLevel)
        }

        const [cardsRes, postsRes, stockRes] = await Promise.all([
          fetch('/api/feed'),
          fetch('/api/posts'),
          fetch(`/api/stocks/${ticker}`),
        ])
        const [cardsData, postsData, stockData] = await Promise.all([
          cardsRes.json(),
          postsRes.json(),
          stockRes.json(),
        ])

        if (stockData.quote) setQuote(stockData.quote)
        setNews(stockData.news ?? [])
        setLoadingNews(false)

        const allCards: JumpCard[] = cardsData.cards ?? []
        const allPosts: VideoPost[] = postsData.posts ?? []

        const tickerCards = allCards.filter(c => c.ticker?.toUpperCase() === ticker.toUpperCase())
        const tickerPosts = allPosts.filter(p => p.ticker?.toUpperCase() === ticker.toUpperCase())

        const merged: FeedItem[] = []
        const maxLen = Math.max(tickerCards.length, tickerPosts.length)
        for (let i = 0; i < maxLen; i++) {
          if (tickerCards[i]) merged.push({ kind: 'card', data: tickerCards[i] })
          if (tickerPosts[i]) merged.push({ kind: 'video', data: tickerPosts[i] })
        }

        // Fallback: show general cards so the player is never empty
        if (merged.length === 0) {
          allCards.slice(0, 5).forEach(c => merged.push({ kind: 'card', data: c }))
        }

        setItems(merged)
        setIndex(0)
      } catch { /* silent */ }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker])

  async function handlePrediction(prediction: 'bullish' | 'bearish') {
    const current = items[index]
    if (!current) return
    setActionFlash(prediction === 'bullish' ? 'bull' : 'bear')
    setTimeout(() => setActionFlash(null), 600)
    const price = current.kind === 'card' ? (current.data.price ?? 0) : 0

    const calls: Promise<unknown>[] = [
      fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, prediction, price }),
      }),
    ]
    if (current.kind === 'card' && current.data.id) {
      calls.push(fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: current.data.id, vote: prediction }),
      }))
    }
    await Promise.allSettled(calls)
    advance()
  }

  function advance() {
    setIndex(i => {
      setHistory(h => [...h.slice(-20), i])
      return i < items.length - 1 ? i + 1 : 0
    })
    setShowDeepDive(false)
  }

  function goBack() {
    setHistory(h => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setIndex(prev)
      return h.slice(0, -1)
    })
    setShowDeepDive(false)
  }

  const current = items[index]
  const isUp = (quote?.dp ?? 0) >= 0

  // ── News article card ──────────────────────────────────────────────────────
  function NewsCard({ item }: { item: NewsItem }) {
    return (
      <div className="rounded-xl border border-[#1e2d4a] p-3" style={{ background: 'rgba(13,20,34,0.8)' }}>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="block group">
          <p className="text-white text-xs font-medium leading-snug mb-1 group-hover:text-[#C9A84C] transition-colors">
            {item.headline}
          </p>
        </a>
        {item.summary && (
          <p className="text-[#6b7280] text-[10px] leading-relaxed mb-2 line-clamp-2">{item.summary}</p>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[#C9A84C] text-[10px] font-bold">{item.source}</span>
          {item.datetime && (
            <>
              <span className="text-[#1e2d4a]">·</span>
              <span className="text-[#6b7280] text-[10px]">{timeAgo(item.datetime)}</span>
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#4b5563] hover:text-[#C9A84C] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span className="text-[10px] font-medium">Read</span>
            </a>
            <button
              onClick={() => setCommentTarget({ url: item.url, title: item.headline })}
              className="flex items-center gap-1 text-[#4b5563] hover:text-[#6b7280] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-[10px] font-medium">Chat</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[110] flex flex-col" style={{ background: 'rgba(4,7,13,0.97)' }}>

      {/* Comments sheets */}
      {showComments && current && (
        <CommentsSheet
          postId={current.kind === 'video' ? current.data.id : undefined}
          cardId={current.kind === 'card' ? current.data.id : undefined}
          title={`$${ticker}`}
          onClose={() => setShowComments(false)}
        />
      )}
      {commentTarget && (
        <CommentsSheet
          articleUrl={commentTarget.url}
          title={commentTarget.title}
          onClose={() => setCommentTarget(null)}
        />
      )}

      {/* Deep Dive modal */}
      {showDeepDive && current?.kind === 'card' && (
        <ExpandedCard
          card={current.data}
          level={level}
          onClose={() => setShowDeepDive(false)}
          onBullish={() => { setShowDeepDive(false); handlePrediction('bullish') }}
          onBearish={() => { setShowDeepDive(false); handlePrediction('bearish') }}
          onTrack={() => {}}
          onJump={() => { setShowDeepDive(false); advance() }}
          tracked={false}
        />
      )}

      {/* ── HEADER ── */}
      <div className="flex-shrink-0 border-b border-[#1e2d4a]">
        <div className="flex items-center justify-between px-5 pt-6 pb-3">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-[#6b7280] text-sm font-bold"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <div className="text-center">
            <div className="text-white font-black text-base">${ticker}</div>
            {quote ? (
              <div className={`text-xs font-bold ${isUp ? 'text-[#00C805]' : 'text-[#FF3B30]'}`}>
                ${quote.c?.toFixed(2)} ({isUp ? '+' : ''}{quote.dp?.toFixed(2)}%)
              </div>
            ) : (
              <div className="text-[#C9A84C] text-[10px] font-bold">
                {loading ? '...' : `${items.length} signals`}
              </div>
            )}
            {/* Optional context badge (e.g. the user's original prediction) */}
            {contextBadge && (
              <div className="mt-0.5">{contextBadge}</div>
            )}
          </div>

          <div className="text-[#6b7280] text-xs font-mono w-14 text-right">
            {activeTab === 'signals' && !loading ? `${index + 1}/${items.length}` : ''}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex">
          <button
            onClick={() => setActiveTab('signals')}
            className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
              activeTab === 'signals' ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]' : 'text-[#6b7280]'
            }`}
          >
            ⚡ Signals
          </button>
          <button
            onClick={() => setActiveTab('news')}
            className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
              activeTab === 'news' ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]' : 'text-[#6b7280]'
            }`}
          >
            📰 News {news.length > 0 && <span className="ml-1 opacity-60">({news.length})</span>}
          </button>
        </div>
      </div>

      {/* Progress bar — signals only */}
      {activeTab === 'signals' && !loading && items.length > 0 && (
        <div className="px-5 pt-2 pb-0 flex-shrink-0">
          <div className="w-full h-px rounded-full overflow-hidden bg-[#1e2d4a]">
            <div
              className="h-full bg-[#C9A84C] rounded-full transition-all duration-300"
              style={{ width: `${((index + 1) / items.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── SIGNALS TAB ── */}
      {activeTab === 'signals' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-5 pb-2 pt-3">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-[#6b7280] text-sm animate-pulse">Loading ${ticker} signals...</div>
              </div>
            ) : !current ? (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-[#6b7280] text-sm">No signals yet for ${ticker}</p>
                </div>
              </div>
            ) : (
              <div className="relative">
                {actionFlash && (
                  <div className={`absolute inset-0 z-10 pointer-events-none rounded-3xl flex items-center justify-center
                    ${actionFlash === 'bull' ? 'bg-[#00C805]/10' : 'bg-[#FF3B30]/10'}`}>
                    <span className="text-5xl">{actionFlash === 'bull' ? '🐂' : '🐻'}</span>
                  </div>
                )}

                {current.kind === 'card' ? (
                  <div className="rounded-3xl border border-[#C9A84C]/20 overflow-hidden" style={{ background: 'rgba(8,12,20,0.88)' }}>
                    <div className="px-5 pt-5 pb-0 flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                        current.data.card_type === 'stock' ? 'bg-[#40A9FF]/15 text-[#40A9FF]' :
                        current.data.card_type === 'social' ? 'bg-[#F59E0B]/15 text-[#F59E0B]' :
                        'bg-[#A855F7]/15 text-[#A855F7]'
                      }`}>
                        {current.data.card_type === 'stock' ? '📉 Stock' :
                         current.data.card_type === 'social' ? '💬 Social' : '🌍 Macro'}
                      </span>
                      {current.data.source_name && (
                        <span className="text-[#6b7280] text-[10px]">via {current.data.source_name}</span>
                      )}
                    </div>
                    <div className="p-5">
                      {current.data.price && (
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-2xl font-bold text-white">${current.data.price.toFixed(2)}</span>
                          <span className={`text-sm font-bold ${(current.data.change_percent ?? 0) >= 0 ? 'text-[#00C805]' : 'text-[#FF3B30]'}`}>
                            {(current.data.change_percent ?? 0) >= 0 ? '+' : ''}{current.data.change_percent?.toFixed(2)}%
                          </span>
                        </div>
                      )}
                      <h3 className="text-white font-bold text-base leading-snug mb-3">{current.data.headline}</h3>
                      <p className="text-[#9ca3af] text-sm leading-relaxed mb-4">{current.data.summary}</p>
                      <div>
                        <div className="flex justify-between text-[10px] font-bold mb-1">
                          <span className="text-[#00C805]">🐂 {current.data.bull_percent}%</span>
                          <span className="text-[#6b7280]">Community Sentiment</span>
                          <span className="text-[#FF3B30]">{current.data.bear_percent}% 🐻</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden bg-[#FF3B30]/30">
                          <div
                            className="h-full bg-[#00C805] rounded-full"
                            style={{ width: `${current.data.bull_percent}%`, transition: 'width 0.6s ease' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-[#C9A84C]/20 overflow-hidden" style={{ background: 'rgba(8,12,20,0.88)' }}>
                    {current.data.videos?.[0] && (
                      <div className="relative aspect-video bg-black">
                        <video
                          src={current.data.videos[0].public_url}
                          className="w-full h-full object-cover"
                          controls
                          playsInline
                        />
                        {current.data.videos.length > 1 && (
                          <div className="absolute top-2 right-2 bg-black/70 rounded-full px-2 py-0.5">
                            <span className="text-white text-[10px] font-bold">{current.data.videos.length} clips</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          current.data.stance === 'bullish' ? 'bg-[#00C805]/15 text-[#00C805]' :
                          current.data.stance === 'bearish' ? 'bg-[#FF3B30]/15 text-[#FF3B30]' :
                          'bg-[#C9A84C]/15 text-[#C9A84C]'
                        }`}>
                          {current.data.stance === 'bullish' ? '🐂 Bullish' :
                           current.data.stance === 'bearish' ? '🐻 Bearish' : '👀 Watching'}
                        </span>
                        <span className="text-[#6b7280] text-xs">by {current.data.author?.username ?? 'Anonymous'}</span>
                      </div>
                      {current.data.caption && (
                        <p className="text-[#9ca3af] text-sm leading-relaxed">{current.data.caption}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Bull / Bear quick-call buttons */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handlePrediction('bullish')}
                    className="py-3 rounded-2xl border border-[#00C805]/40 text-[#00C805] font-bold text-sm active:scale-95"
                    style={{ background: 'rgba(0,200,5,0.1)' }}
                  >
                    🐂 Bullish
                  </button>
                  <button
                    onClick={() => handlePrediction('bearish')}
                    className="py-3 rounded-2xl border border-[#FF3B30]/40 text-[#FF3B30] font-bold text-sm active:scale-95"
                    style={{ background: 'rgba(255,59,48,0.1)' }}
                  >
                    🐻 Bearish
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stationary bottom action bar */}
          {!loading && current && (
            <div className="flex-shrink-0 px-5 pt-1 pb-4 flex items-center justify-between border-t border-[#1e2d4a]">
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
              </div>

              {/* Center: pulsating JUMP circle */}
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

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('news')}
                  className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-all"
                  style={{ background: 'rgba(30,45,74,0.6)', border: '1px solid rgba(30,45,74,0.8)' }}
                >
                  <span className="text-base leading-none">📰</span>
                  <span className="text-[8px] font-bold text-[#6b7280]">News</span>
                </button>
                <button
                  onClick={() => current.kind === 'card' && setShowDeepDive(true)}
                  disabled={current.kind !== 'card'}
                  className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-all disabled:opacity-30"
                  style={{ background: 'rgba(30,45,74,0.6)', border: '1px solid rgba(30,45,74,0.8)' }}
                >
                  <span className="text-base leading-none">🔍</span>
                  <span className="text-[8px] font-bold text-[#6b7280]">Dive</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── NEWS TAB ── */}
      {activeTab === 'news' && (
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadingNews ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="rounded-xl border border-[#1e2d4a] p-3 space-y-2" style={{ background: 'rgba(13,20,34,0.8)' }}>
                  <div className="h-3 bg-[#1e2d4a] rounded animate-pulse w-full" />
                  <div className="h-3 bg-[#1e2d4a] rounded animate-pulse w-3/4" />
                  <div className="h-2 bg-[#1e2d4a] rounded animate-pulse w-1/3" />
                </div>
              ))}
            </div>
          ) : news.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-[#6b7280] text-sm">No recent news for ${ticker}</p>
              <button
                onClick={() => setActiveTab('signals')}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-[#C9A84C]"
                style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}
              >
                ← Back to Signals
              </button>
            </div>
          ) : (
            <>
              <div className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider mb-3">
                ${ticker} · {news.length} articles
              </div>
              <div className="space-y-2">
                {news.map((item, i) => (
                  <NewsCard key={i} item={item} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
