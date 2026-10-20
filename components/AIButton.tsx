'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useAIFocus, type AIFocus } from '@/lib/aiFocus'
import type { UserLevel } from '@/lib/types'

const QUICK_TICKERS = ['SPY', 'NVDA', 'AAPL', 'TSLA', 'MSFT', 'AMZN']

interface Quote { price: number; changePercent: number }

function Sparkles({ className }: { className: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l1.09 3.26L16 6.5l-2.91 1.24L12 11l-1.09-3.26L8 6.5l2.91-1.24L12 2z" />
      <path d="M19 14l.73 2.18L22 17l-2.27.82L19 20l-.73-2.18L16 17l2.27-.82L19 14z" />
      <path d="M5 14l.73 2.18L8 17l-2.27.82L5 20l-.73-2.18L2 17l2.27-.82L5 14z" />
    </svg>
  )
}

export default function AIButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl active:scale-90 transition-all hover:bg-white/5 active:bg-white/10"
        style={{
          background: 'linear-gradient(135deg, #1B3066 0%, #6d28d9 100%)',
          // Glow must stay within the 44px header row's 4px vertical clearance
          boxShadow: '0 0 4px rgba(109,40,217,0.5)',
          border: '1.5px solid rgba(109,40,217,0.4)',
        }}
        aria-label="AI Deep Dive"
      >
        <Sparkles className="w-5 h-5 text-white" />
      </button>

      {/* Portaled to <body>: the header's backdrop-filter/transform would otherwise
          become the containing block for this fixed drawer and squash it into the header row */}
      {open && createPortal(<DeepDiveDrawer onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}

function DeepDiveDrawer({ onClose }: { onClose: () => void }) {
  const focus = useAIFocus()
  // Snapshot the on-screen stock when the drawer opens; the user can switch tickers from here
  const [target, setTarget] = useState<AIFocus | null>(focus)
  const [input, setInput] = useState('')
  const [level, setLevel] = useState<UserLevel>('rookie')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('level').eq('id', user.id).single()
      if (data?.level) setLevel(data.level as UserLevel)
    })
  }, [])

  useEffect(() => {
    if (target) analyse(target)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, level])

  async function analyse(t: AIFocus) {
    const id = ++requestId.current
    setLoading(true)
    setAnalysis('')
    setError(null)
    setQuote(null)

    try {
      // Live quote + latest company news give Claude something concrete to analyse
      let context: AIFocus = t
      if (t.ticker && t.cardType !== 'macro') {
        const res = await fetch(`/api/stocks/${encodeURIComponent(t.ticker)}`)
        const data = await res.json()
        if (id !== requestId.current) return
        const q = data.quote
        if (!q || !q.c) {
          setError('not_found')
          setLoading(false)
          return
        }
        setQuote({ price: q.c, changePercent: q.dp ?? 0 })
        const news = data.news?.[0]
        context = {
          ...t,
          changePercent: q.dp ?? t.changePercent,
          headline: t.headline ?? news?.headline ?? `${t.ticker} trading at $${q.c}`,
          summary: t.summary ?? news?.summary ?? `Day range $${q.l}–$${q.h}, previous close $${q.pc}.`,
          source: t.source ?? news?.source ?? 'Finnhub',
        }
      }

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardType: context.cardType ?? 'stock',
          ticker: context.ticker,
          headline: context.headline,
          summary: context.summary,
          changePercent: context.changePercent,
          source: context.source,
          level,
        }),
      })
      const data = await res.json()
      if (id !== requestId.current) return
      if (data.analysis) setAnalysis(data.analysis)
      else setError(data.error ?? 'unavailable')
    } catch {
      if (id === requestId.current) setError('unavailable')
    }
    if (id === requestId.current) setLoading(false)
  }

  function pick(ticker: string) {
    const t = ticker.trim().toUpperCase().replace(/^\$/, '')
    if (!t) return
    setInput('')
    setTarget({ ticker: t })
  }

  const isPositive = (quote?.changePercent ?? 0) >= 0

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-3xl flex flex-col"
        style={{
          background: '#0d1422',
          border: '1px solid rgba(109,40,217,0.3)',
          borderBottom: 'none',
          maxHeight: '85dvh',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-none px-5 pt-3">
          <div className="w-10 h-1 rounded-full bg-[#2a2a3a] mx-auto mb-4" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #1B3066, #6d28d9)' }}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-white font-black text-base leading-tight">AI Deep Dive</div>
                <div className="text-[#6b7280] text-[10px] uppercase tracking-wider">Tuned for {level}</div>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-full text-[#6b7280] hover:bg-white/5">
              ✕
            </button>
          </div>

          {/* Ticker picker */}
          <form onSubmit={e => { e.preventDefault(); pick(input) }} className="flex gap-2 mb-3">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={target ? `Analyse another ticker (now ${target.ticker})` : 'Enter a ticker, e.g. NVDA'}
              autoCapitalize="characters"
              autoCorrect="off"
              className="flex-1 min-w-0 bg-[#12121a] border border-[#2a2a3a] rounded-xl px-3 py-2 text-sm text-white placeholder-[#4b5563] focus:outline-none focus:border-[#6d28d9]"
            />
            <button type="submit" className="px-4 rounded-xl text-sm font-bold text-white" style={{ background: '#6d28d9' }}>
              Go
            </button>
          </form>
          {!target && (
            <div className="flex flex-wrap gap-2 mb-3">
              {QUICK_TICKERS.map(t => (
                <button key={t} onClick={() => pick(t)} className="px-3 py-1 rounded-full text-xs font-bold text-[#C9A84C] border border-[#C9A84C]/30">
                  ${t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5">
          {target && (
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-white font-black text-2xl">${target.ticker}</span>
              {quote && (
                <>
                  <span className="text-white font-bold">${quote.price.toFixed(2)}</span>
                  <span className={`font-bold text-sm ${isPositive ? 'text-[#00C805]' : 'text-[#FF3B30]'}`}>
                    {isPositive ? '+' : ''}{quote.changePercent.toFixed(2)}%
                  </span>
                </>
              )}
            </div>
          )}
          {target?.headline && (
            <p className="text-[#9ca3af] text-xs mb-3 leading-relaxed">{target.headline}</p>
          )}

          {!target ? (
            <p className="text-[#6b7280] text-sm text-center py-6">Pick a stock and Claude will break it down for you.</p>
          ) : loading ? (
            <div className="space-y-2 py-2">
              <div className="h-3 bg-[#111827] rounded animate-pulse w-full" />
              <div className="h-3 bg-[#111827] rounded animate-pulse w-4/5" />
              <div className="h-3 bg-[#111827] rounded animate-pulse w-5/6" />
              <div className="h-3 bg-[#111827] rounded animate-pulse w-3/4" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <p className="text-[#6b7280] text-xs leading-relaxed">
                {error === 'not_found'
                  ? `Couldn't find a live quote for $${target.ticker}. Check the ticker and try again.`
                  : error === 'no_key' || error === 'no_credits'
                    ? 'AI analysis is unavailable: the Claude API key or credits need attention.'
                    : 'Analysis temporarily unavailable.'}
              </p>
              {error === 'unavailable' && (
                <button onClick={() => analyse(target)} className="text-[#C9A84C] text-xs font-bold border border-[#C9A84C]/30 px-3 py-1 rounded-full">
                  Retry
                </button>
              )}
            </div>
          ) : (
            <p className="text-[#d1d5db] text-sm leading-relaxed whitespace-pre-wrap pb-2">{analysis}</p>
          )}
        </div>
      </div>
    </div>
  )
}
