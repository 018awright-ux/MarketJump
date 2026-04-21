'use client'

import { useState, useEffect, useRef } from 'react'
import { MOCK_CARDS } from '@/lib/mock-data'
import type { JumpCard } from '@/lib/types'

interface SearchResult {
  symbol: string
  description: string
}

interface Quote {
  c: number
  dp: number
}

interface NewsItem {
  id: number
  headline: string
  source: string
  url: string
}

interface StockData {
  ticker: string
  quote: Quote | null
  news: NewsItem[]
  cards: JumpCard[]
}

const TRENDING = ['AAPL', 'NVDA', 'TSLA', 'AMZN', 'META', 'MSFT', 'AMD', 'SPY']

const SECTORS = [
  { name: 'Tech', change: 1.8, up: true },
  { name: 'Energy', change: 2.3, up: true },
  { name: 'Healthcare', change: -0.4, up: false },
  { name: 'Finance', change: 0.9, up: true },
  { name: 'Crypto', change: 4.1, up: true },
  { name: 'Commodities', change: -1.2, up: false },
  { name: 'Real Estate', change: -0.7, up: false },
  { name: 'Macro', change: 0.3, up: true },
  { name: 'Consumer', change: 1.1, up: true },
]

export default function ExplorePage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [loadingStock, setLoadingStock] = useState(false)
  const [cardIndex, setCardIndex] = useState(0)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data.results ?? [])
      } catch { setResults([]) }
      setSearching(false)
    }, 400)
  }, [query])

  async function loadStock(ticker: string) {
    setLoadingStock(true)
    setQuery('')
    setResults([])
    setCardIndex(0)
    try {
      const res = await fetch(`/api/stocks/${ticker}`)
      const data = await res.json()
      // Get cards for this ticker from mock (or all cards if none match)
      const tickerCards = MOCK_CARDS.filter(c => c.ticker === ticker)
      setStockData({
        ticker,
        quote: data.quote,
        news: data.news ?? [],
        cards: tickerCards.length > 0 ? tickerCards : MOCK_CARDS.slice(0, 3),
      })
    } catch {
      setStockData({ ticker, quote: null, news: [], cards: [] })
    }
    setLoadingStock(false)
  }

  function jumpNext() {
    if (!stockData) return
    setCardIndex(i => (i + 1) % stockData.cards.length)
  }

  const currentCard = stockData?.cards[cardIndex]
  const isUp = (stockData?.quote?.dp ?? 0) >= 0

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-5 pt-4 pb-3">
        <h1 className="text-xl font-black text-white mb-3">Explore</h1>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search any ticker or company..."
            className="w-full border rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none transition-colors"
            style={{ background: 'rgba(13,20,34,0.8)', borderColor: 'rgba(201,168,76,0.2)' }}
          />
          {searching && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Search dropdown */}
        {results.length > 0 && (
          <div className="mt-1 rounded-xl overflow-hidden border border-[#1e2d4a] z-20 relative" style={{ background: 'rgba(13,20,34,0.97)' }}>
            {results.map(r => (
              <button
                key={r.symbol}
                onClick={() => loadStock(r.symbol)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#C9A84C]/10 transition-colors border-b border-[#1e2d4a] last:border-0"
              >
                <span className="font-bold text-[#C9A84C]">{r.symbol}</span>
                <span className="text-[#6b7280] text-sm truncate max-w-[200px]">{r.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4">

        {/* Selected stock panel */}
        {stockData && (
          <div className="mb-5 animate-slide-up">
            <div className="rounded-2xl border border-[#C9A84C]/25 overflow-hidden" style={{ background: 'rgba(8,12,20,0.88)' }}>
              {loadingStock ? (
                <div className="p-4 space-y-3">
                  <div className="h-6 bg-[#1e2d4a] rounded animate-pulse w-1/3" />
                  <div className="h-4 bg-[#1e2d4a] rounded animate-pulse w-1/2" />
                </div>
              ) : (
                <>
                  {/* Stock header */}
                  <div className="flex items-center justify-between p-4 border-b border-[#1e2d4a]">
                    <div>
                      <div className="text-2xl font-black text-white">{stockData.ticker}</div>
                      {stockData.quote && (
                        <div className={`text-sm font-bold ${isUp ? 'text-[#00C805]' : 'text-[#FF3B30]'}`}>
                          ${stockData.quote.c?.toFixed(2)}{' '}
                          ({isUp ? '+' : ''}{stockData.quote.dp?.toFixed(2)}%)
                        </div>
                      )}
                    </div>
                    {/* Card counter */}
                    {stockData.cards.length > 0 && (
                      <span className="text-[#6b7280] text-xs font-mono">
                        {cardIndex + 1}/{stockData.cards.length} topics
                      </span>
                    )}
                  </div>

                  {/* Current card preview */}
                  {currentCard && (
                    <div className="p-4 border-b border-[#1e2d4a]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                          currentCard.source === 'reddit' ? 'bg-[#FF4500]/15 text-[#FF4500]' :
                          currentCard.source === 'stocktwits' ? 'bg-[#40A9FF]/15 text-[#40A9FF]' :
                          'bg-[#C9A84C]/15 text-[#C9A84C]'
                        }`}>
                          {currentCard.source}
                        </span>
                        {currentCard.source_name && (
                          <span className="text-[#6b7280] text-xs">{currentCard.source_name}</span>
                        )}
                      </div>
                      <p className="text-white text-sm font-semibold leading-snug mb-1">{currentCard.headline}</p>
                      <p className="text-[#9ca3af] text-xs leading-relaxed line-clamp-3">{currentCard.summary}</p>

                      {/* Momentum mini */}
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-[#00C805] text-xs font-bold">🐂 {currentCard.bull_percent}%</span>
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,59,48,0.3)' }}>
                          <div className="h-full bg-[#00C805] rounded-full" style={{ width: `${currentCard.bull_percent}%` }} />
                        </div>
                        <span className="text-[#FF3B30] text-xs font-bold">{currentCard.bear_percent}% 🐻</span>
                      </div>
                    </div>
                  )}

                  {/* JUMP button — cycles topics */}
                  <div className="flex justify-center py-4">
                    <button
                      onClick={jumpNext}
                      className="w-16 h-16 rounded-full font-black text-xs tracking-widest transition-all active:scale-90 flex flex-col items-center justify-center gap-0.5 shadow-lg"
                      style={{
                        background: 'linear-gradient(135deg, #1B3066 0%, #2a4a8a 50%, #C9A84C 100%)',
                        color: '#fff',
                        boxShadow: '0 0 20px rgba(201,168,76,0.3)',
                      }}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="text-[8px] font-black tracking-widest">JUMP</span>
                    </button>
                  </div>

                  {/* Latest news */}
                  {stockData.news.length > 0 && (
                    <div className="border-t border-[#1e2d4a] p-4">
                      <div className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider mb-2">Latest News</div>
                      <div className="space-y-2">
                        {stockData.news.slice(0, 4).map(n => (
                          <a
                            key={n.id}
                            href={n.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-xl p-3 border border-[#1e2d4a] hover:border-[#C9A84C]/30 transition-colors"
                            style={{ background: 'rgba(30,45,74,0.3)' }}
                          >
                            <p className="text-white text-xs font-medium leading-snug mb-1">{n.headline}</p>
                            <span className="text-[#6b7280] text-[10px]">{n.source}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Trending tickers */}
        <div className="mb-5">
          <div className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider mb-3">Trending on MarketJump</div>
          <div className="flex flex-wrap gap-2">
            {TRENDING.map(ticker => (
              <button
                key={ticker}
                onClick={() => loadStock(ticker)}
                className="px-4 py-2 rounded-xl border text-sm font-bold transition-all active:scale-95"
                style={{
                  background: stockData?.ticker === ticker ? 'rgba(201,168,76,0.15)' : 'rgba(13,20,34,0.8)',
                  borderColor: stockData?.ticker === ticker ? 'rgba(201,168,76,0.5)' : 'rgba(30,45,74,0.8)',
                  color: stockData?.ticker === ticker ? '#C9A84C' : '#fff',
                }}
              >
                {ticker}
              </button>
            ))}
          </div>
        </div>

        {/* Sector heatmap */}
        <div className="mb-5">
          <div className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider mb-3">Sector Pulse</div>
          <div className="grid grid-cols-3 gap-2">
            {SECTORS.map(sector => (
              <div
                key={sector.name}
                className="rounded-xl p-3 text-center border"
                style={{
                  background: sector.up ? 'rgba(0,200,5,0.08)' : 'rgba(255,59,48,0.08)',
                  borderColor: sector.up ? 'rgba(0,200,5,0.2)' : 'rgba(255,59,48,0.2)',
                }}
              >
                <div className="text-xs text-[#9ca3af] mb-1">{sector.name}</div>
                <div className={`text-sm font-bold ${sector.up ? 'text-[#00C805]' : 'text-[#FF3B30]'}`}>
                  {sector.up ? '+' : ''}{sector.change}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Macro feed */}
        <div>
          <div className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider mb-3">Macro Pulse</div>
          <div className="space-y-2">
            {[
              { headline: 'Fed holds rates at 4.25-4.50%, signals two cuts in 2025', source: 'Federal Reserve', time: '2h ago' },
              { headline: 'OPEC+ extends production cuts through Q3, Brent crude spikes 4%', source: 'Reuters', time: '4h ago' },
              { headline: 'US-China trade tensions escalate: 60% tariffs on EVs proposed', source: 'Reuters', time: '6h ago' },
              { headline: 'CPI comes in at 2.8% YoY, cooler than expected', source: 'BLS', time: '8h ago' },
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-[#1e2d4a] p-3" style={{ background: 'rgba(13,20,34,0.8)' }}>
                <p className="text-white text-xs font-medium leading-snug mb-1">{item.headline}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[#C9A84C] text-[10px]">{item.source}</span>
                  <span className="text-[#1e2d4a]">·</span>
                  <span className="text-[#6b7280] text-[10px]">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
