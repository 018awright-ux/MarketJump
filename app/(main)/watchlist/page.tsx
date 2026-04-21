'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MOCK_CARDS } from '@/lib/mock-data'
import type { JumpCard, VideoPost } from '@/lib/types'

interface WatchlistItem {
  id: string
  ticker: string
  added_at: string
  predictions?: {
    prediction: string
    result: string
    price_at_prediction: number
  }
}

interface QuoteMap {
  [ticker: string]: { c: number; dp: number; d: number }
}

interface UserPrediction {
  ticker: string
  prediction: string
  price_at_prediction: number
  created_at: string
}

interface CardSentiment {
  ticker: string
  bull_percent: number
  bear_percent: number
}

type FeedItem =
  | { kind: 'card'; data: JumpCard }
  | { kind: 'video'; data: VideoPost }

// ── Inline jump player for a specific ticker ─────────────────────────────────
function TickerJumpPlayer({
  ticker,
  onClose,
}: {
  ticker: string
  onClose: () => void
}) {
  const supabase = createClient()
  const [items, setItems] = useState<FeedItem[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionFlash, setActionFlash] = useState<'bull' | 'bear' | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // Cards for this ticker from DB, falling back to mock
        const [cardsRes, postsRes] = await Promise.all([
          fetch('/api/feed'),
          fetch('/api/posts'),
        ])
        const [cardsData, postsData] = await Promise.all([
          cardsRes.json(),
          postsRes.json(),
        ])

        const allCards: JumpCard[] = cardsData.cards ?? MOCK_CARDS
        const allPosts: VideoPost[] = postsData.posts ?? []

        const tickerCards = allCards.filter(
          c => c.ticker.toUpperCase() === ticker.toUpperCase()
        )
        const tickerPosts = allPosts.filter(
          p => p.ticker.toUpperCase() === ticker.toUpperCase()
        )

        // Interleave: card, post, card, post...
        const merged: FeedItem[] = []
        const maxLen = Math.max(tickerCards.length, tickerPosts.length)
        for (let i = 0; i < maxLen; i++) {
          if (tickerCards[i]) merged.push({ kind: 'card', data: tickerCards[i] })
          if (tickerPosts[i]) merged.push({ kind: 'video', data: tickerPosts[i] })
        }

        // If nothing specific to ticker, fall back to all mock cards for that ticker
        if (merged.length === 0) {
          const fallback = MOCK_CARDS.filter(
            c => c.ticker.toUpperCase() === ticker.toUpperCase()
          )
          fallback.forEach(c => merged.push({ kind: 'card', data: c }))
        }

        // If still nothing, show all cards (so the player is never empty)
        if (merged.length === 0) {
          allCards.slice(0, 5).forEach(c => merged.push({ kind: 'card', data: c }))
        }

        setItems(merged)
        setIndex(0)
      } catch { /* silent */ }
      setLoading(false)
    }
    load()
  }, [ticker])

  async function handlePrediction(prediction: 'bullish' | 'bearish') {
    const current = items[index]
    if (!current) return
    setActionFlash(prediction === 'bullish' ? 'bull' : 'bear')
    setTimeout(() => setActionFlash(null), 600)
    const price = current.kind === 'card' ? (current.data.price ?? 0) : 0
    await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, prediction, price }),
    })
    advance()
  }

  function advance() {
    setIndex(i => (i < items.length - 1 ? i + 1 : 0))
  }

  const current = items[index]

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(4,7,13,0.97)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-3 border-b border-[#1e2d4a]">
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
          <div className="text-[#C9A84C] text-[10px] font-bold">
            {loading ? '...' : `${items.length} signals`}
          </div>
        </div>
        <div className="text-[#6b7280] text-xs font-mono">
          {loading ? '' : `${index + 1}/${items.length}`}
        </div>
      </div>

      {/* Progress bar */}
      {!loading && items.length > 0 && (
        <div className="px-5 pt-2 pb-1">
          <div className="w-full h-px rounded-full overflow-hidden bg-[#1e2d4a]">
            <div
              className="h-full bg-[#C9A84C] rounded-full transition-all duration-300"
              style={{ width: `${((index + 1) / items.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
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
          <div className="relative pt-4">
            {/* Action flash */}
            {actionFlash && (
              <div className={`absolute inset-0 z-10 pointer-events-none rounded-3xl flex items-center justify-center
                ${actionFlash === 'bull' ? 'bg-[#00C805]/10' : 'bg-[#FF3B30]/10'}`}>
                <span className="text-5xl">{actionFlash === 'bull' ? '🐂' : '🐻'}</span>
              </div>
            )}

            {current.kind === 'card' ? (
              /* ── Jump Card view ── */
              <div
                className="rounded-3xl border border-[#C9A84C]/20 overflow-hidden"
                style={{ background: 'rgba(8,12,20,0.88)' }}
              >
                {/* Card type tag */}
                <div className="px-5 pt-5 pb-0">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    current.data.card_type === 'stock' ? 'bg-[#40A9FF]/15 text-[#40A9FF]' :
                    current.data.card_type === 'social' ? 'bg-[#F59E0B]/15 text-[#F59E0B]' :
                    'bg-[#A855F7]/15 text-[#A855F7]'
                  }`}>
                    {current.data.card_type === 'stock' ? '📉 Stock' :
                     current.data.card_type === 'social' ? '💬 Social' : '🌍 Macro'}
                  </span>
                  {current.data.source_name && (
                    <span className="text-[#6b7280] text-[10px] ml-2">via {current.data.source_name}</span>
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
                  <h3 className="text-white font-bold text-base leading-snug mb-3">
                    {current.data.headline}
                  </h3>
                  <p className="text-[#9ca3af] text-sm leading-relaxed mb-4">
                    {current.data.summary}
                  </p>

                  {/* Sentiment mini-bar */}
                  <div className="mb-2">
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
              /* ── Video Post view ── */
              <div
                className="rounded-3xl border border-[#C9A84C]/20 overflow-hidden"
                style={{ background: 'rgba(8,12,20,0.88)' }}
              >
                {/* First clip preview */}
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
                       current.data.stance === 'bearish' ? '🐻 Bearish' : '⚖️ Neutral'}
                    </span>
                    <span className="text-[#6b7280] text-xs">by {current.data.author?.username ?? 'Anonymous'}</span>
                  </div>
                  {current.data.caption && (
                    <p className="text-[#9ca3af] text-sm leading-relaxed">{current.data.caption}</p>
                  )}
                </div>
              </div>
            )}

            {/* Action row */}
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

            {/* JUMP circle */}
            <div className="flex justify-center mt-5">
              <button
                onClick={advance}
                className="w-20 h-20 rounded-full flex flex-col items-center justify-center gap-0.5 active:scale-90 animate-jump-pulse"
                style={{
                  background: 'linear-gradient(135deg, #1B3066 0%, #2a4a8a 50%, #C9A84C 100%)',
                  color: '#fff',
                }}
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-[9px] font-black tracking-widest">JUMP</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Watchlist Page ───────────────────────────────────────────────────────
export default function WatchlistPage() {
  const supabase = createClient()
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [quotes, setQuotes] = useState<QuoteMap>({})
  const [userPredictions, setUserPredictions] = useState<Record<string, UserPrediction>>({})
  const [cardSentiments, setCardSentiments] = useState<Record<string, CardSentiment>>({})
  const [loading, setLoading] = useState(true)
  const [jumpTicker, setJumpTicker] = useState<string | null>(null)

  useEffect(() => {
    loadWatchlist()
  }, [])

  async function loadWatchlist() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id

      const res = await fetch('/api/watchlist')
      const data = await res.json()
      const list: WatchlistItem[] = data.watchlist ?? []
      setItems(list)

      const tickers = list.map(i => i.ticker)

      const [quoteResults, predRows, sentimentRows] = await Promise.all([
        Promise.all(
          list.map(async item => {
            try {
              const r = await fetch(`/api/stocks/${item.ticker}`)
              const d = await r.json()
              return { ticker: item.ticker, quote: d.quote ?? null }
            } catch {
              return { ticker: item.ticker, quote: null }
            }
          })
        ),
        userId
          ? supabase
              .from('predictions')
              .select('ticker, prediction, price_at_prediction, created_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .then(r => r.data ?? [])
          : Promise.resolve([]),
        tickers.length > 0
          ? supabase
              .from('jump_cards')
              .select('ticker, bull_percent, bear_percent')
              .in('ticker', tickers)
              .then(r => r.data ?? [])
          : Promise.resolve([]),
      ])

      const quoteMap: QuoteMap = {}
      for (const { ticker, quote } of quoteResults) {
        if (quote) quoteMap[ticker] = quote
      }
      setQuotes(quoteMap)

      const predMap: Record<string, UserPrediction> = {}
      for (const pred of (predRows as UserPrediction[])) {
        if (!predMap[pred.ticker]) predMap[pred.ticker] = pred
      }
      setUserPredictions(predMap)

      const sentMap: Record<string, CardSentiment> = {}
      for (const row of (sentimentRows as CardSentiment[])) {
        sentMap[row.ticker] = row
      }
      setCardSentiments(sentMap)
    } catch { /* skip */ }
    setLoading(false)
  }

  async function removeFromWatchlist(ticker: string) {
    await fetch('/api/watchlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker }),
    })
    setItems(prev => prev.filter(i => i.ticker !== ticker))
  }

  async function makePrediction(ticker: string, prediction: 'bullish' | 'bearish') {
    const price = quotes[ticker]?.c ?? 0
    await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, prediction, price }),
    })
    loadWatchlist()
  }

  // Show inline jump player
  if (jumpTicker) {
    return <TickerJumpPlayer ticker={jumpTicker} onClose={() => setJumpTicker(null)} />
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[#6b7280] text-sm animate-pulse">Loading watchlist...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h1 className="text-xl font-black text-white">Tracklist</h1>
        <span className="text-[#6b7280] text-sm">{items.length} stocks</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-5xl mb-4">⭐</div>
            <h2 className="text-white font-bold text-lg mb-2">Tracklist is empty</h2>
            <p className="text-[#6b7280] text-sm">
              Tap ⭐ Track on any card in your Jump Feed to add stocks here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => {
              const quote = quotes[item.ticker]
              const isUp = (quote?.dp ?? 0) >= 0
              const pred = item.predictions
              const userPred = userPredictions[item.ticker]
              const sentiment = cardSentiments[item.ticker]
              const bull = sentiment?.bull_percent ?? 50
              const bear = sentiment?.bear_percent ?? 50

              return (
                <div key={item.id} className="rounded-2xl border border-[#2a2a3a] p-4" style={{ background: 'rgba(8,12,20,0.88)' }}>
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-lg font-black text-white">${item.ticker}</div>
                        {/* Inline JUMP button */}
                        <button
                          onClick={() => setJumpTicker(item.ticker)}
                          className="flex items-center gap-1 text-[9px] font-black tracking-widest px-2.5 py-1 rounded-full active:scale-95 animate-jump-pulse"
                          style={{
                            background: 'linear-gradient(135deg, #1B3066, #C9A84C)',
                            color: '#fff',
                          }}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          JUMP
                        </button>
                      </div>
                      {quote ? (
                        <div className={`text-sm font-bold ${isUp ? 'text-[#00C805]' : 'text-[#FF3B30]'}`}>
                          ${quote.c?.toFixed(2)}{' '}
                          <span className="text-xs opacity-80">({isUp ? '+' : ''}{quote.dp?.toFixed(2)}%)</span>
                        </div>
                      ) : (
                        <div className="text-[#6b7280] text-xs">Price unavailable</div>
                      )}
                    </div>
                    <button
                      onClick={() => removeFromWatchlist(item.ticker)}
                      className="text-[#6b7280] hover:text-[#FF3B30] transition-colors p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Your call badge */}
                  {userPred && (
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: userPred.prediction === 'bullish' ? 'rgba(0,200,5,0.12)' : 'rgba(255,59,48,0.12)',
                          color: userPred.prediction === 'bullish' ? '#00C805' : '#FF3B30',
                          border: `1px solid ${userPred.prediction === 'bullish' ? 'rgba(0,200,5,0.25)' : 'rgba(255,59,48,0.25)'}`,
                        }}
                      >
                        Your call: {userPred.prediction === 'bullish' ? '🐂 Bullish' : '🐻 Bearish'}
                      </span>
                      <span className="text-[#6b7280] text-[10px]">
                        @ ${userPred.price_at_prediction?.toFixed(2)} · {new Date(userPred.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {/* Community sentiment mini-bar */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[10px] text-[#00C805] font-bold">🐂 {bull}%</span>
                      <span className="text-[9px] text-[#6b7280]">Community</span>
                      <span className="text-[10px] text-[#FF3B30] font-bold">{bear}% 🐻</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden bg-[#FF3B30]/30">
                      <div
                        className="h-full rounded-full bg-[#00C805]"
                        style={{ width: `${bull}%`, transition: 'width 0.6s ease' }}
                      />
                    </div>
                  </div>

                  {/* Legacy prediction badge */}
                  {pred && !userPred && (
                    <div className="mb-3 flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        pred.prediction === 'bullish' ? 'bg-[#00C805]/15 text-[#00C805]' : 'bg-[#FF3B30]/15 text-[#FF3B30]'
                      }`}>
                        {pred.prediction === 'bullish' ? '🐂 Bullish' : '🐻 Bearish'}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        pred.result === 'correct' ? 'bg-[#00C805]/15 text-[#00C805]' :
                        pred.result === 'incorrect' ? 'bg-[#FF3B30]/15 text-[#FF3B30]' :
                        'bg-[#1a1a26] text-[#6b7280]'
                      }`}>
                        {pred.result === 'correct' ? '✓ Correct' : pred.result === 'incorrect' ? '✗ Wrong' : '⏳ Pending'}
                      </span>
                    </div>
                  )}

                  {/* Quick prediction buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => makePrediction(item.ticker, 'bullish')}
                      className="bg-[#00C805]/10 border border-[#00C805]/30 rounded-xl py-2 text-[#00C805] text-xs font-bold active:scale-95"
                    >
                      🐂 Bullish
                    </button>
                    <button
                      onClick={() => makePrediction(item.ticker, 'bearish')}
                      className="bg-[#FF3B30]/10 border border-[#FF3B30]/30 rounded-xl py-2 text-[#FF3B30] text-xs font-bold active:scale-95"
                    >
                      🐻 Bearish
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
