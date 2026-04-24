'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { JumpCard, UserLevel } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import CommentsSheet from '@/components/CommentsSheet'
import ExpandedCard from '@/components/ExpandedCard'
import PullIndicator from '@/components/PullIndicator'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'

interface SearchResult {
  symbol: string
  description: string
}

interface Quote {
  c: number
  dp: number
}

interface NewsItem {
  id?: number
  ticker?: string
  headline: string
  summary?: string
  source: string
  url: string
  datetime: number
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

const TRENDING = ['SPY', 'QQQ', 'DIA', 'IWM', 'AAPL', 'NVDA', 'TSLA', 'AMZN', 'META', 'MSFT', 'AMD']

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
  const [sectors, setSectors] = useState<SectorItem[]>([])

  // Personalized data
  const [watchlistTickers, setWatchlistTickers] = useState<string[]>([])
  const [interests, setInterests] = useState<string[]>([])
  const [watchlistNews, setWatchlistNews] = useState<NewsItem[]>([])
  const [generalNews, setGeneralNews] = useState<NewsItem[]>([])
  const [interestCards, setInterestCards] = useState<JumpCard[]>([])
  const [loadingPersonalized, setLoadingPersonalized] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [newsTab, setNewsTab] = useState<'yours' | 'market'>('yours')
  const [trackedTickers, setTrackedTickers] = useState<Set<string>>(new Set())
  const [commentTarget, setCommentTarget] = useState<{ url: string; title: string } | null>(null)
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({})
  const [userLevel, setUserLevel] = useState<UserLevel>('rookie')
  const [showExpandedCard, setShowExpandedCard] = useState(false)
  const [showCardComments, setShowCardComments] = useState(false)
  const [cardCommentCounts, setCardCommentCounts] = useState<Record<string, number>>({})
  const [cardHistory, setCardHistory] = useState<number[]>([])

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ptr = usePullToRefresh(async () => {
    setLoadingPersonalized(true)
    fetch('/api/sectors').then(r => r.json()).then(d => { if (d.sectors?.length > 0) setSectors(d.sectors) }).catch(() => {})
    try {
      const res = await fetch('/api/news/personalized')
      const d = await res.json()
      setWatchlistNews(d.watchlistNews ?? [])
      setGeneralNews(d.generalNews ?? [])
      setInterestCards(d.cards ?? [])
    } catch {
      try { const d = await (await fetch('/api/news')).json(); setGeneralNews(d.news ?? []) } catch {}
    }
    setLoadingPersonalized(false)
  })

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      setIsLoggedIn(!!user)

      if (user) {
        supabase.from('profiles').select('level').eq('id', user.id).single()
          .then(({ data }) => { if (data) setUserLevel(data.level as UserLevel) })

        supabase.from('watchlist').select('ticker').eq('user_id', user.id)
          .then(({ data }) => {
            if (data) {
              const tickers = data.map((w: { ticker: string }) => w.ticker)
              setTrackedTickers(new Set(tickers))
              // Batch-fetch company names for watchlist tickers
              if (tickers.length) fetchCompanyNames(tickers)
            }
          })
      }

      // Load top brands
      supabase
        .from('profiles')
        .select('id, username, brand_name, level, market_score, accuracy, total_predictions')
        .order('market_score', { ascending: false })
        .limit(6)
        .then(({ data }) => setTopBrands(data ?? []))

      // Load sector data
      fetch('/api/sectors')
        .then(r => r.json())
        .then(d => { if (d.sectors?.length > 0) setSectors(d.sectors) })
        .catch(() => {})

      // Pre-fetch company names for trending tickers
      fetchCompanyNames(TRENDING)

      if (user) {
        // Load personalized feed
        fetch('/api/news/personalized')
          .then(r => r.json())
          .then(d => {
            setWatchlistNews(d.watchlistNews ?? [])
            setGeneralNews(d.generalNews ?? [])
            setInterestCards(d.cards ?? [])
            setInterests(d.interests ?? [])
            setWatchlistTickers(d.watchlistTickers ?? [])
          })
          .catch(() => {
            // Fallback: load general news
            fetch('/api/news')
              .then(r => r.json())
              .then(d => setGeneralNews(d.news ?? []))
              .catch(() => {})
          })
          .finally(() => setLoadingPersonalized(false))
      } else {
        // Not logged in — show general news
        fetch('/api/news')
          .then(r => r.json())
          .then(d => setGeneralNews(d.news ?? []))
          .catch(() => {})
          .finally(() => setLoadingPersonalized(false))
      }
    }

    init()
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
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        const hits: SearchResult[] = data.results ?? []
        setResults(hits)
        // Cache company names from search results
        if (hits.length) {
          setCompanyNames(prev => {
            const next = { ...prev }
            for (const r of hits) if (r.description && !next[r.symbol]) next[r.symbol] = r.description
            return next
          })
        }
      } catch { setResults([]) }
      setSearching(false)
    }, 400)
  }, [query, searchMode])

  async function fetchCompanyNames(tickers: string[]) {
    if (!tickers.length) return
    // Step 1: check jump_cards (our own DB — fastest, free)
    const found: Record<string, string> = {}
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('jump_cards')
        .select('ticker, company_name')
        .in('ticker', tickers)
        .not('company_name', 'is', null)
      if (data) {
        for (const row of data as { ticker: string; company_name: string }[]) {
          if (row.company_name) found[row.ticker] = row.company_name
        }
      }
    } catch {}

    // Merge what we found from jump_cards into state immediately
    setCompanyNames(prev => {
      const next = { ...prev }
      for (const [ticker, name] of Object.entries(found)) {
        if (!next[ticker]) next[ticker] = name
      }
      return next
    })

    // Step 2: for any ticker still without a name, call the search API as fallback
    // Use current state + freshly found to determine what's still missing
    setCompanyNames(prev => {
      const stillMissing = tickers.filter(t => !prev[t] && !found[t])
      if (stillMissing.length > 0) {
        // Fire-and-forget: fetch search results for each missing ticker
        for (const ticker of stillMissing) {
          fetch(`/api/search?q=${encodeURIComponent(ticker)}`)
            .then(r => r.json())
            .then((d: { results?: SearchResult[] }) => {
              const hit = (d.results ?? []).find(
                (r: SearchResult) => r.symbol.toUpperCase() === ticker.toUpperCase()
              )
              if (hit?.description) {
                setCompanyNames(p => p[ticker] ? p : { ...p, [ticker]: hit.description })
              }
            })
            .catch(() => {})
        }
      }
      return prev // no change here — updates come from the async fetch above
    })
  }

  async function loadStock(ticker: string) {
    // Scroll to top so the stock panel is visible immediately
    ptr.scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    setLoadingStock(true)
    setQuery('')
    setResults([])
    setCardIndex(0)
    setCardHistory([])
    setShowExpandedCard(false)
    setShowCardComments(false)
    // Fetch company name if not already known
    if (!companyNames[ticker]) fetchCompanyNames([ticker])
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

  const currentCard = stockData?.cards[cardIndex]
  const isUp = (stockData?.quote?.dp ?? 0) >= 0

  async function toggleTrack(ticker: string) {
    if (!isLoggedIn) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (trackedTickers.has(ticker)) {
      await supabase.from('watchlist').delete().eq('user_id', user.id).eq('ticker', ticker)
      setTrackedTickers(prev => { const n = new Set(prev); n.delete(ticker); return n })
      setWatchlistTickers(prev => prev.filter(t => t !== ticker))
    } else {
      await supabase.from('watchlist').insert({ user_id: user.id, ticker })
      setTrackedTickers(prev => new Set([...prev, ticker]))
      setWatchlistTickers(prev => prev.includes(ticker) ? prev : [ticker, ...prev])
    }
  }

  function NewsCard({ item }: { item: NewsItem }) {
    return (
      <div
        className="rounded-xl border border-[#1e2d4a] p-3 transition-colors"
        style={{ background: 'rgba(13,20,34,0.8)' }}
      >
        {item.ticker && (
          <span className="text-[10px] font-bold text-[#C9A84C] bg-[#C9A84C]/10 px-2 py-0.5 rounded-full mr-2">
            {item.ticker}
          </span>
        )}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <p className="text-white text-xs font-medium leading-snug mb-1 mt-1 hover:text-[#C9A84C] transition-colors">{item.headline}</p>
        </a>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[#C9A84C] text-[10px]">{item.source}</span>
          {item.datetime && (
            <>
              <span className="text-[#1e2d4a]">·</span>
              <span className="text-[#6b7280] text-[10px]">{timeAgo(item.datetime)}</span>
            </>
          )}
          <button
            className="ml-auto flex items-center gap-1 text-[#4b5563] hover:text-[#6b7280] transition-colors"
            onClick={() => setCommentTarget({ url: item.url, title: item.headline })}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-[10px] font-medium">Chat</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {commentTarget && (
        <CommentsSheet
          articleUrl={commentTarget.url}
          title={commentTarget.title}
          onClose={() => setCommentTarget(null)}
        />
      )}
      <div className="px-5 pt-4 pb-3">
        <h1 className="text-xl font-black text-white mb-3">Markets</h1>

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
            className={`flex-1 py-2 text-xs font-bold transition-colors ${searchMode === 'stocks' ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]' : 'text-[#6b7280]'}`}
          >
            Stocks
          </button>
          <button
            onClick={() => setSearchMode('people')}
            className={`flex-1 py-2 text-xs font-bold transition-colors ${searchMode === 'people' ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]' : 'text-[#6b7280]'}`}
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

      <div ref={ptr.scrollRef} className="flex-1 overflow-y-auto px-5 pb-4" {...ptr.touchHandlers}>
        <PullIndicator pullDistance={ptr.pullDistance} refreshing={ptr.refreshing} />

        {/* ── STOCK SEARCH RESULT PANEL ─────────────────────────────── */}
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
                  {/* ── Stock header ── */}
                  <div className="flex items-center justify-between p-4 border-b border-[#1e2d4a]">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <div className="text-2xl font-black text-white">{stockData.ticker}</div>
                        {companyNames[stockData.ticker] && (
                          <div className="text-[#6b7280] text-sm truncate max-w-[140px]">{companyNames[stockData.ticker]}</div>
                        )}
                      </div>
                      {stockData.quote && (
                        <div className={`text-sm font-bold ${isUp ? 'text-[#00C805]' : 'text-[#FF3B30]'}`}>
                          ${stockData.quote.c?.toFixed(2)} ({isUp ? '+' : ''}{stockData.quote.dp?.toFixed(2)}%)
                        </div>
                      )}
                    </div>
                    {stockData.cards.length > 0 && (
                      <span className="text-[#6b7280] text-xs font-mono">{cardIndex + 1}/{stockData.cards.length}</span>
                    )}
                  </div>

                  {/* ── Current card content ── */}
                  {currentCard && (
                    <div className="p-4 border-b border-[#1e2d4a]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                          currentCard.source === 'reddit' ? 'bg-[#FF4500]/15 text-[#FF4500]' :
                          currentCard.source === 'stocktwits' ? 'bg-[#40A9FF]/15 text-[#40A9FF]' :
                          'bg-[#C9A84C]/15 text-[#C9A84C]'
                        }`}>{currentCard.source}</span>
                        {currentCard.source_name && <span className="text-[#6b7280] text-xs">{currentCard.source_name}</span>}
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

                  {/* ── Action bar: Back | Chat | JUMP | Track | Dive ── */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d4a]">

                    {/* Back */}
                    <button
                      onClick={() => {
                        setCardHistory(h => {
                          if (h.length === 0) return h
                          const prev = h[h.length - 1]
                          setCardIndex(prev)
                          return h.slice(0, -1)
                        })
                      }}
                      disabled={cardHistory.length === 0}
                      className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-0.5 disabled:opacity-25 transition-all active:scale-90"
                      style={{ background: 'rgba(30,45,74,0.6)', border: '1px solid rgba(30,45,74,0.8)' }}
                    >
                      <svg className="w-4 h-4 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span className="text-[8px] font-bold text-[#6b7280]">Back</span>
                    </button>

                    {/* Chat */}
                    <div className="relative">
                      <button
                        onClick={() => setShowCardComments(true)}
                        className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-all"
                        style={{ background: 'rgba(30,45,74,0.6)', border: '1px solid rgba(30,45,74,0.8)' }}
                      >
                        <svg className="w-4 h-4 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span className="text-[8px] font-bold text-[#6b7280]">Chat</span>
                      </button>
                      {currentCard && (cardCommentCounts[currentCard.id] ?? 0) > 0 && (
                        <span
                          className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center text-[9px] font-black pointer-events-none"
                          style={{ background: '#C9A84C', color: '#000' }}
                        >
                          {(cardCommentCounts[currentCard.id] ?? 0) > 99 ? '99+' : cardCommentCounts[currentCard.id]}
                        </span>
                      )}
                    </div>

                    {/* JUMP — big center button */}
                    <button
                      onClick={() => {
                        if (!stockData || stockData.cards.length === 0) return
                        setCardHistory(h => [...h.slice(-20), cardIndex])
                        setCardIndex(i => (i + 1) % stockData.cards.length)
                      }}
                      disabled={stockData.cards.length <= 1}
                      className="w-20 h-20 rounded-full flex flex-col items-center justify-center gap-1 active:scale-90 transition-all animate-jump-pulse disabled:opacity-40 disabled:animate-none"
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

                    {/* Track */}
                    <button
                      onClick={() => isLoggedIn && toggleTrack(stockData.ticker)}
                      disabled={!isLoggedIn}
                      className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-all disabled:opacity-30"
                      style={{
                        background: trackedTickers.has(stockData.ticker) ? 'rgba(201,168,76,0.15)' : 'rgba(30,45,74,0.6)',
                        border: `1px solid ${trackedTickers.has(stockData.ticker) ? 'rgba(201,168,76,0.5)' : 'rgba(30,45,74,0.8)'}`,
                      }}
                    >
                      <span className="text-base leading-none">{trackedTickers.has(stockData.ticker) ? '⭐' : '☆'}</span>
                      <span className={`text-[8px] font-bold ${trackedTickers.has(stockData.ticker) ? 'text-[#C9A84C]' : 'text-[#6b7280]'}`}>Track</span>
                    </button>

                    {/* Deep Dive */}
                    <button
                      onClick={() => currentCard && setShowExpandedCard(true)}
                      disabled={!currentCard}
                      className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-0.5 active:scale-90 transition-all disabled:opacity-30"
                      style={{ background: 'rgba(30,45,74,0.6)', border: '1px solid rgba(30,45,74,0.8)' }}
                    >
                      <span className="text-base leading-none">🔍</span>
                      <span className="text-[8px] font-bold text-[#6b7280]">Dive</span>
                    </button>
                  </div>

                  {stockData.news.length > 0 && (
                    <div className="p-4">
                      <div className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider mb-2">Latest News</div>
                      <div className="space-y-2">
                        {stockData.news.slice(0, 5).map((n, i) => <NewsCard key={i} item={n} />)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── STOCKS MODE CONTENT ───────────────────────────────────── */}
        {searchMode === 'stocks' && (
          <>
            {/* Watchlist quick chips */}
            {watchlistTickers.length > 0 && (
              <div className="mb-5">
                <div className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider mb-3">Your Tracklist</div>
                <div className="flex flex-wrap gap-2">
                  {watchlistTickers.map(ticker => (
                    <button
                      key={ticker}
                      onClick={() => loadStock(ticker)}
                      className="flex flex-col items-start px-3 py-2 rounded-xl border transition-all active:scale-95"
                      style={{
                        background: stockData?.ticker === ticker ? 'rgba(201,168,76,0.15)' : 'rgba(13,20,34,0.8)',
                        borderColor: stockData?.ticker === ticker ? 'rgba(201,168,76,0.5)' : 'rgba(30,45,74,0.8)',
                      }}
                    >
                      <span className="text-sm font-bold" style={{ color: stockData?.ticker === ticker ? '#C9A84C' : '#fff' }}>{ticker}</span>
                      {companyNames[ticker] && (
                        <span className="text-[9px] text-[#6b7280] truncate max-w-[72px]">{companyNames[ticker]}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending (shown when no watchlist or always) */}
            <div className="mb-5">
              <div className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider mb-3">
                {watchlistTickers.length > 0 ? 'Trending on MarketJump' : 'Trending'}
              </div>
              <div className="flex flex-wrap gap-2">
                {TRENDING.filter(t => !watchlistTickers.includes(t)).map(ticker => (
                  <button
                    key={ticker}
                    onClick={() => loadStock(ticker)}
                    className="flex flex-col items-start px-3 py-2 rounded-xl border transition-all active:scale-95"
                    style={{
                      background: stockData?.ticker === ticker ? 'rgba(201,168,76,0.15)' : 'rgba(13,20,34,0.8)',
                      borderColor: stockData?.ticker === ticker ? 'rgba(201,168,76,0.5)' : 'rgba(30,45,74,0.8)',
                    }}
                  >
                    <span className="text-sm font-bold" style={{ color: stockData?.ticker === ticker ? '#C9A84C' : '#fff' }}>{ticker}</span>
                    {companyNames[ticker] && (
                      <span className="text-[9px] text-[#6b7280] truncate max-w-[72px]">{companyNames[ticker]}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Sector Pulse — clickable tiles that load stock detail */}
            {sectors.length > 0 && (
              <div className="mb-5">
                <div className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider mb-3">Sector Pulse</div>
                <div className="grid grid-cols-3 gap-2">
                  {sectors.map(sector => (
                    <button
                      key={sector.name}
                      onClick={() => loadStock(sector.symbol)}
                      className="rounded-xl p-3 text-center border transition-all active:scale-95"
                      style={{
                        background: stockData?.ticker === sector.symbol
                          ? (sector.up ? 'rgba(0,200,5,0.2)' : 'rgba(255,59,48,0.2)')
                          : (sector.up ? 'rgba(0,200,5,0.08)' : 'rgba(255,59,48,0.08)'),
                        borderColor: stockData?.ticker === sector.symbol
                          ? (sector.up ? 'rgba(0,200,5,0.6)' : 'rgba(255,59,48,0.6)')
                          : (sector.up ? 'rgba(0,200,5,0.2)' : 'rgba(255,59,48,0.2)'),
                      }}
                    >
                      <div className="text-[10px] text-[#9ca3af] mb-0.5 font-medium">{sector.name}</div>
                      <div className="text-[10px] text-[#6b7280] mb-1">{sector.symbol}</div>
                      <div className={`text-sm font-bold ${sector.up ? 'text-[#00C805]' : 'text-[#FF3B30]'}`}>
                        {sector.change === null ? '—' : `${sector.up ? '+' : ''}${sector.change.toFixed(2)}%`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── NEWS TABS ── */}
            <div>
              {/* Tab row — only show "Your News" tab when logged in and have personalized data */}
              {isLoggedIn && (watchlistNews.length > 0 || interestCards.length > 0) ? (
                <>
                  <div className="flex border-b border-[#2a2a3a] mb-3">
                    <button
                      onClick={() => setNewsTab('yours')}
                      className={`flex-1 py-2 text-xs font-bold transition-colors ${newsTab === 'yours' ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]' : 'text-[#6b7280]'}`}
                    >
                      Your News
                    </button>
                    <button
                      onClick={() => setNewsTab('market')}
                      className={`flex-1 py-2 text-xs font-bold transition-colors ${newsTab === 'market' ? 'text-[#C9A84C] border-b-2 border-[#C9A84C]' : 'text-[#6b7280]'}`}
                    >
                      Market News
                    </button>
                  </div>

                  {newsTab === 'yours' ? (
                    <div className="space-y-2">
                      {/* Watchlist news */}
                      {watchlistNews.map((item, i) => <NewsCard key={`wl-${i}`} item={item} />)}

                      {/* Interest-matched cards */}
                      {interestCards.slice(0, 5).map(card => (
                        <div key={card.id} className="rounded-xl border border-[#1e2d4a] p-3" style={{ background: 'rgba(13,20,34,0.8)' }}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[#C9A84C] text-xs font-black">{card.ticker}</span>
                            {card.company_name && <span className="text-[#6b7280] text-[10px] truncate">{card.company_name}</span>}
                          </div>
                          <p className="text-white text-xs font-medium leading-snug mb-1">{card.headline}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[#00C805] text-[10px] font-bold">🐂 {card.bull_percent}%</span>
                            <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,59,48,0.3)' }}>
                              <div className="h-full bg-[#00C805] rounded-full" style={{ width: `${card.bull_percent}%` }} />
                            </div>
                            <span className="text-[#FF3B30] text-[10px] font-bold">{card.bear_percent}% 🐻</span>
                          </div>
                        </div>
                      ))}

                      {watchlistNews.length === 0 && interestCards.length === 0 && (
                        <div className="text-[#6b7280] text-xs text-center py-6">
                          Add stocks to your Tracklist to see personalized news.
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Market News tab */
                    loadingPersonalized ? (
                      <div className="space-y-2">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="rounded-xl border border-[#1e2d4a] p-3 space-y-2" style={{ background: 'rgba(13,20,34,0.8)' }}>
                            <div className="h-3 bg-[#1e2d4a] rounded animate-pulse w-full" />
                            <div className="h-3 bg-[#1e2d4a] rounded animate-pulse w-2/3" />
                            <div className="h-2 bg-[#1e2d4a] rounded animate-pulse w-1/3" />
                          </div>
                        ))}
                      </div>
                    ) : generalNews.length > 0 ? (
                      <div className="space-y-2">
                        {generalNews.map((item, i) => <NewsCard key={`gn-${i}`} item={item} />)}
                      </div>
                    ) : (
                      <div className="text-[#6b7280] text-xs text-center py-6">No news available right now.</div>
                    )
                  )}
                </>
              ) : (
                /* Not logged in or no personalized data — show market news only */
                <>
                  <div className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider mb-3">Market News</div>
                  {loadingPersonalized ? (
                    <div className="space-y-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="rounded-xl border border-[#1e2d4a] p-3 space-y-2" style={{ background: 'rgba(13,20,34,0.8)' }}>
                          <div className="h-3 bg-[#1e2d4a] rounded animate-pulse w-full" />
                          <div className="h-3 bg-[#1e2d4a] rounded animate-pulse w-2/3" />
                          <div className="h-2 bg-[#1e2d4a] rounded animate-pulse w-1/3" />
                        </div>
                      ))}
                    </div>
                  ) : generalNews.length > 0 ? (
                    <div className="space-y-2">
                      {generalNews.map((item, i) => <NewsCard key={`gn-${i}`} item={item} />)}
                    </div>
                  ) : (
                    <div className="text-[#6b7280] text-xs text-center py-6">No news available right now.</div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* ── PEOPLE MODE ───────────────────────────────────────────── */}
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

      {/* ── Deep Dive modal for stock cards ── */}
      {showExpandedCard && currentCard && (
        <ExpandedCard
          card={currentCard}
          level={userLevel}
          onClose={() => setShowExpandedCard(false)}
          onBullish={() => setShowExpandedCard(false)}
          onBearish={() => setShowExpandedCard(false)}
          onTrack={() => toggleTrack(stockData!.ticker)}
          onJump={() => {
            setShowExpandedCard(false)
            if (stockData && stockData.cards.length > 1) {
              setCardHistory(h => [...h.slice(-20), cardIndex])
              setCardIndex(i => (i + 1) % stockData.cards.length)
            }
          }}
          tracked={trackedTickers.has(stockData?.ticker ?? '')}
        />
      )}

      {/* ── Comments sheet for current stock card ── */}
      {showCardComments && (
        <CommentsSheet
          cardId={currentCard?.id}
          title={currentCard ? `${currentCard.ticker} · ${currentCard.headline}` : stockData?.ticker}
          onClose={() => setShowCardComments(false)}
          onCommentPosted={() => {
            if (currentCard) {
              setCardCommentCounts(prev => ({ ...prev, [currentCard.id]: (prev[currentCard.id] ?? 0) + 1 }))
            }
          }}
        />
      )}
    </div>
  )
}
