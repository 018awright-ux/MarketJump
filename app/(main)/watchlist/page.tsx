'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import TickerDetailView from '@/components/TickerDetailView'
import PullIndicator from '@/components/PullIndicator'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'

interface WatchlistItem {
  id: string
  ticker: string
  added_at: string
  company_name?: string | null
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

export default function WatchlistPage() {
  const supabase = createClient()
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [quotes, setQuotes] = useState<QuoteMap>({})
  const [userPredictions, setUserPredictions] = useState<Record<string, UserPrediction>>({})
  const [cardSentiments, setCardSentiments] = useState<Record<string, CardSentiment>>({})
  const [loading, setLoading] = useState(true)
  const [openTicker, setOpenTicker] = useState<string | null>(null)
  const ptr = usePullToRefresh(async () => { await loadWatchlist() })

  useEffect(() => { loadWatchlist() }, [])

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

  if (openTicker) {
    return <TickerDetailView ticker={openTicker} onClose={() => setOpenTicker(null)} />
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-shrink-0">
        <h1 className="text-xl font-black text-white">Tracklist</h1>
        <span className="text-[#6b7280] text-sm">{loading ? '...' : `${items.length} stocks`}</span>
      </div>

      <div ref={ptr.scrollRef} className="flex-1 overflow-y-auto px-5 pb-4" {...ptr.touchHandlers}>
        <PullIndicator pullDistance={ptr.pullDistance} refreshing={ptr.refreshing} />
        {loading && items.length === 0 ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-[#12121a] animate-pulse border border-[#2a2a3a]" />
            ))}
          </div>
        ) : items.length === 0 ? (
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
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#2a2a3a] overflow-hidden"
                  style={{ background: 'rgba(8,12,20,0.88)' }}
                >
                  {/* Tappable header — opens detail view */}
                  <button
                    onClick={() => setOpenTicker(item.ticker)}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <div className="text-lg font-black text-white">${item.ticker}</div>
                          {item.company_name && (
                            <div className="text-[#6b7280] text-xs truncate max-w-[120px]">{item.company_name}</div>
                          )}
                        </div>
                        <span
                          className="flex items-center gap-1 text-[9px] font-black tracking-widest px-2.5 py-1 rounded-full animate-jump-pulse"
                          style={{ background: 'linear-gradient(135deg, #1B3066, #C9A84C)', color: '#fff' }}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          JUMP
                        </span>
                      </div>
                      <svg className="w-4 h-4 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    {quote ? (
                      <div className={`text-sm font-bold ${isUp ? 'text-[#00C805]' : 'text-[#FF3B30]'}`}>
                        ${quote.c?.toFixed(2)}{' '}
                        <span className="text-xs opacity-80">({isUp ? '+' : ''}{quote.dp?.toFixed(2)}%)</span>
                      </div>
                    ) : (
                      <div className="text-[#6b7280] text-xs">Tap to view signals & news →</div>
                    )}
                  </button>

                  <div className="px-4 pb-4">
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

                    {/* Quick actions */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => makePrediction(item.ticker, 'bullish')}
                        className="bg-[#00C805]/10 border border-[#00C805]/30 rounded-xl py-2 text-[#00C805] text-xs font-bold active:scale-95"
                      >
                        🐂 Bull
                      </button>
                      <button
                        onClick={() => makePrediction(item.ticker, 'bearish')}
                        className="bg-[#FF3B30]/10 border border-[#FF3B30]/30 rounded-xl py-2 text-[#FF3B30] text-xs font-bold active:scale-95"
                      >
                        🐻 Bear
                      </button>
                      <button
                        onClick={() => removeFromWatchlist(item.ticker)}
                        className="bg-[#1e2d4a]/40 border border-[#2a2a3a] rounded-xl py-2 text-[#6b7280] text-xs font-bold active:scale-95"
                      >
                        ✕ Remove
                      </button>
                    </div>
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
