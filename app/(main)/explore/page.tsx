'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { JumpCard } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

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
  summary: string
  source: string
  url: string
  datetime: number
  related?: string
}

interface SectorItem {
  name: string
  symbol: string
  change: number | null
  up: boolean
}

interface StockData {
  ticker: string
  quote: Quote | null
  news: NewsItem[]
  cards: JumpCard[]
}

interface BrandResult {
  id: string
  username: string
  brand_name: string | null
  level: string
  market_score: number
  accuracy: number
  total_predictions: number
}

const TRENDING = ['AAPL', 'NVDA', 'TSLA', 'AMZN', 'META', 'MSFT', 'AMD', 'SPY']

function timeAgo(unix: number): string {
  const diff = Math.floor(Date.now() / 1000) - unix
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function ExplorePage() {
  const router = useRouter()
  const [searchMode, setSearchMode] = useState<'stocks' | 'people'>('stocks')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [loadingStock, setLoadingStock] = useState(false)
  const [cardIndex, setCardIndex] = useState(0)
  const [brandResults, setBrandResults] = useState<BrandResult[]>([])
  const [topBrands, setTopBrands] = useState<BrandResult[]>([])
  const [marketNews, setMarketNews] = useState<NewsItem[]>([])
  const [sectors, setSectors] = useState<SectorItem[]>([])
  const [loadingNews, setLoadingNews] = useState(true)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load top brands, market news, and sector data on mount
  useEffect(() => {
    const supabase = createClient()

    async function loadTopBrands() {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, brand_name, level, market_score, accuracy, total_predictions')
        .order('market_score', { ascending: false })
        .limit(6)
      setTopBrands(data ?? [])
    }

    async function loadNews() {
      try {
        const res = await fetch('/api/news')
        const data = await res.json()
        setMarketNews(data.news ?? [])
      } catch { /* keep empty */ }
      setLoadingNews(false)
    }

    async function loadSectors() {
      try {
        const res = await fetch('/api/sectors')
        const data = await res.json()
        if (data.sectors?.length > 0) setSectors(data.sectors)
      } catch { /* keep empty */ }
    }

    loadTopBrands()
    loadNews()
    loadSectors()
  }, [])

  // Clear results when search mode changes
  useEffect(() => {
    setQuery('')
    setResults([])
    setBrandResults([])
  }, [searchMode])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setBrandResults([])
      return
    }
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setSearching(true)
      if (searchMode === 'people') {
        try {
          const supabase = createClient()
          const { data } = await supabase
            .from('profiles')
            .select('id, username, brand_name, level, market_score, accuracy, total_predictions')
            .or(`username.ilike.%${query}%,brand_name.ilike.%${query}%`)
            .limit(10)
          setBrandResults(data ?? [])
        } catch {
          setBrandResults([])
        }
        setSearching(false)
        return
      }
      // stocks mode
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data.results ?? [])
      } catch { setResults([]) }
      setSearching(false)
    }, 400)
  }, [query, searchMode])

  async function loadStock(ticker: string) {
    setLoadingStock(true)
    setQuery('')
    setResults([])
    setCardIndex(0)
    try {
      const supabase = createClient()
      const [stockRes, { data: dbCards }] = await Promise.all([
        fetch(`/api/stocks/${ticker}`),
        supabase
          .from('jump_cards')
          .select('*')
          .eq('ticker', ticker)
          .order('created_at', { ascending: false })
          .limit(10),
      ])
      const data = await stockRes.json()
      setStockData({
        ticker,
        quote: data.quote,
        news: data.news ?? [],
        cards: (dbCards ?? []) as JumpCard[],
      })
    } catch {
      setStockData({ ticker, quote: null, news: [], cards: [] })
    }
    setLoadingStock(false)
  }

  function jumpNext() {
    if (!stockData) return
    setCardIndex(i => (i + 1) % Math.max(stockData.cards.length, 1))
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
            placeholder={searchMode === 'stocks' ? 'Search any ticker or company...' : 'Search brands or usernames...'}
            className="w-full border rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none transition-colors"
            style={{ background: 'rgba(13,20,34,0.8)', borderColor: 'rgba(201,168,76,0.2)' }}
          />
          {searching && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Search mode tabs */}
        <div className="flex border-b border-[#2a2a3a] mb-3 mt-2">
          <button
            onClick={() => setSearchMode('stocks')}
            className={`flex-1 py-2 text-xs font-bold transition-colors ${
              searchMode === 'stocks'
                ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]'
                : 'text-[#6b7280]'
            }`}
          >
            Stocks
          </button>
          <button
            onClick={() => setSearchMode('people')}
            className={`flex-1 py-2 text-xs font-bold transition-colors ${
              searchMode === 'people'
                ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]'
                : 'text-[#6b7280]'
            }`}
          >
            People
          </button>
        </div>

        {/* Stock search dropdown */}
        {searchMode === 'stocks' && results.length > 0 && (
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

        {/* People search results */}
        {searchMode === 'people' && brandResults.length > 0 && (
          <div className="mt-2 space-y-2">
            {brandResults.map(b => (
              <button key={b.id} onClick={() => router.push(`/profile/${b.id}`)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-[#2a2a3a] bg-[#12121a] hover:border-[#C9A84C]/30 transition-colors">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-base flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #1B3066, #C9A84C)', color: '#fff' }}>
                  {(b.brand_name || b.username)[0].toUpperCase()}
                </div>
                <div className="flex-1 text-left">
                  <div className="text-white font-bold text-sm">{b.brand_name || b.username}</div>
                  <div className="text-[#6b7280] text-xs">{b.accuracy?.toFixed(1)}% acc · {b.market_score} score</div>
                </div>
                <div className="text-[#C9A84C] text-xs font-bold capitalize">{b.level}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4">

        {/* Selected stock panel */}
        {searchMode === 'stocks' && stockData && (
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

                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-[#00C805] text-xs font-bold">🐂 {currentCard.bull_percent}%</span>
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,59,48,0.3)' }}>
                          <div className="h-full bg-[#00C805] rounded-full" style={{ width: `${currentCard.bull_percent}%` }} />
                        </div>
                        <span className="text-[#FF3B30] text-xs font-bold">{currentCard.bear_percent}% 🐻</span>
                      </div>
                    </div>
                  )}

                  {stockData.cards.length > 1 && (
                    <div className="flex justify-center py-3 border-b border-[#1e2d4a]">
                      <button
                        onClick={jumpNext}
                        className="w-14 h-14 rounded-full font-black text-xs tracking-widest transition-all active:scale-90 flex flex-col items-center justify-center gap-0.5 shadow-lg"
                        style={{
                          background: 'linear-gradient(135deg, #1B3066 0%, #2a4a8a 50%, #C9A84C 100%)',
                          color: '#fff',
                          boxShadow: '0 0 20px rgba(201,168,76,0.3)',
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="text-[8px] font-black tracking-widest">JUMP</span>
                      </button>
                    </div>
                  )}

                  {/* Latest news from Finnhub */}
                  {stockData.news.length > 0 && (
                    <div className="p-4">
                      <div className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider mb-2">Latest News</div>
                      <div className="space-y-2">
                        {stockData.news.slice(0, 5).map((n, i) => (
                          <a
                            key={n.id ?? i}
                            href={n.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-xl p-3 border border-[#1e2d4a] hover:border-[#C9A84C]/30 transition-colors"
                            style={{ background: 'rgba(30,45,74,0.3)' }}
                          >
                            <p className="text-white text-xs font-medium leading-snug mb-1">{n.headline}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[#C9A84C] text-[10px]">{n.source}</span>
                              {n.datetime && (
                                <>
                                  <span className="text-[#1e2d4a]">·</span>
                                  <span className="text-[#6b7280] text-[10px]">{timeAgo(n.datetime)}</span>
                                </>
                              )}
                            </div>
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

        {/* Stocks mode: Trending + Sectors + Market News */}
        {searchMode === 'stocks' && (
          <>
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

            {/* Sector heatmap — real ETF data */}
            {sectors.length > 0 && (
              <div className="mb-5">
                <div className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider mb-3">Sector Pulse</div>
                <div className="grid grid-cols-3 gap-2">
                  {sectors.map(sector => (
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
                        {sector.change === null ? '—' : `${sector.up ? '+' : ''}${sector.change.toFixed(2)}%`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Market News — real Finnhub general news */}
            <div>
              <div className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider mb-3">Market News</div>
              {loadingNews ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-xl border border-[#1e2d4a] p-3 space-y-2" style={{ background: 'rgba(13,20,34,0.8)' }}>
                      <div className="h-3 bg-[#1e2d4a] rounded animate-pulse w-full" />
                      <div className="h-3 bg-[#1e2d4a] rounded animate-pulse w-2/3" />
                      <div className="h-2 bg-[#1e2d4a] rounded animate-pulse w-1/3" />
                    </div>
                  ))}
                </div>
              ) : marketNews.length > 0 ? (
                <div className="space-y-2">
                  {marketNews.map((item, i) => (
                    <a
                      key={item.id ?? i}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl border border-[#1e2d4a] p-3 hover:border-[#C9A84C]/30 transition-colors"
                      style={{ background: 'rgba(13,20,34,0.8)' }}
                    >
                      <p className="text-white text-xs font-medium leading-snug mb-1">{item.headline}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#C9A84C] text-[10px]">{item.source}</span>
                        {item.datetime && (
                          <>
                            <span className="text-[#1e2d4a]">·</span>
                            <span className="text-[#6b7280] text-[10px]">{timeAgo(item.datetime)}</span>
                          </>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-[#6b7280] text-xs text-center py-6">No news available right now.</div>
              )}
            </div>
          </>
        )}

        {/* People mode: Top Brands */}
        {searchMode === 'people' && !query.trim() && (
          <div>
            <div className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider mb-3">Top Brands to Follow</div>
            {topBrands.length > 0 ? (
              <div className="space-y-2">
                {topBrands.map(b => (
                  <button key={b.id} onClick={() => router.push(`/profile/${b.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl border border-[#2a2a3a] bg-[#12121a] hover:border-[#C9A84C]/30 transition-colors">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-base flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #1B3066, #C9A84C)', color: '#fff' }}>
                      {(b.brand_name || b.username)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-white font-bold text-sm">{b.brand_name || b.username}</div>
                      <div className="text-[#6b7280] text-xs">{b.accuracy?.toFixed(1)}% acc · {b.market_score} score</div>
                    </div>
                    <div className="text-[#C9A84C] text-xs font-bold capitalize">{b.level}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-[#6b7280] text-xs text-center py-8">Loading top brands...</div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
