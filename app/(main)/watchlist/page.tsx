'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  [ticker: string]: {
    c: number
    dp: number
    d: number
  }
}

export default function WatchlistPage() {
  const supabase = createClient()
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [quotes, setQuotes] = useState<QuoteMap>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWatchlist()
  }, [])

  async function loadWatchlist() {
    setLoading(true)
    try {
      const res = await fetch('/api/watchlist')
      const data = await res.json()
      const list: WatchlistItem[] = data.watchlist ?? []
      setItems(list)

      // Fetch quotes for all tickers
      const quoteMap: QuoteMap = {}
      await Promise.all(
        list.map(async item => {
          try {
            const r = await fetch(`/api/stocks/${item.ticker}`)
            const d = await r.json()
            if (d.quote) quoteMap[item.ticker] = d.quote
          } catch { /* skip */ }
        })
      )
      setQuotes(quoteMap)
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
        <h1 className="text-xl font-black text-white">Watchlist</h1>
        <span className="text-[#6b7280] text-sm">{items.length} stocks</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-5xl mb-4">⭐</div>
            <h2 className="text-white font-bold text-lg mb-2">No stocks tracked yet</h2>
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

              return (
                <div key={item.id} className="bg-[#12121a] rounded-2xl border border-[#2a2a3a] p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-lg font-black text-white">{item.ticker}</div>
                      {quote ? (
                        <div className={`text-sm font-bold ${isUp ? 'text-[#00C805]' : 'text-[#FF3B30]'}`}>
                          ${quote.c?.toFixed(2)}{' '}
                          <span className="text-xs">({isUp ? '+' : ''}{quote.dp?.toFixed(2)}%)</span>
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

                  {/* Prediction status */}
                  {pred && (
                    <div className="mb-3 flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        pred.prediction === 'bullish'
                          ? 'bg-[#00C805]/15 text-[#00C805]'
                          : 'bg-[#FF3B30]/15 text-[#FF3B30]'
                      }`}>
                        {pred.prediction === 'bullish' ? '🐂 Bullish' : '🐻 Bearish'}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        pred.result === 'correct' ? 'bg-[#00C805]/15 text-[#00C805]' :
                        pred.result === 'incorrect' ? 'bg-[#FF3B30]/15 text-[#FF3B30]' :
                        'bg-[#1a1a26] text-[#6b7280]'
                      }`}>
                        {pred.result === 'correct' ? '✓ Correct' :
                         pred.result === 'incorrect' ? '✗ Wrong' : '⏳ Pending'}
                      </span>
                    </div>
                  )}

                  {/* Quick actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => makePrediction(item.ticker, 'bullish')}
                      className="bg-[#00C805]/10 border border-[#00C805]/30 rounded-xl py-2 text-[#00C805] text-xs font-bold hover:bg-[#00C805]/20 transition-colors"
                    >
                      🐂 Bullish
                    </button>
                    <button
                      onClick={() => makePrediction(item.ticker, 'bearish')}
                      className="bg-[#FF3B30]/10 border border-[#FF3B30]/30 rounded-xl py-2 text-[#FF3B30] text-xs font-bold hover:bg-[#FF3B30]/20 transition-colors"
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
