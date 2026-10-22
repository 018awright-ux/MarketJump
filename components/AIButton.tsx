'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAIFocus } from '@/lib/aiFocus'

interface Turn { role: 'user' | 'assistant'; content: string }
interface Allowance { plan: 'free' | 'pro'; limit: number; used: number; remaining: number; windowLabel: string; resetsAt: string | null }

const STARTERS = [
  'How are my open calls looking for Judgment Day?',
  'Where am I strongest and weakest as a caller?',
  'What is MarketJump talking about this week, and why?',
  'How does Judgment Day scoring work?',
]

function Sparkles({ className }: { className: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l1.09 3.26L16 6.5l-2.91 1.24L12 11l-1.09-3.26L8 6.5l2.91-1.24L12 2z" />
      <path d="M19 14l.73 2.18L22 17l-2.27.82L19 20l-.73-2.18L16 17l2.27-.82L19 14z" />
      <path d="M5 14l.73 2.18L8 17l-2.27.82L5 20l-.73-2.18L2 17l2.27-.82L5 14z" />
    </svg>
  )
}

// Minimal formatting for model output: **bold** only; everything else stays plain text
function Formatted({ text }: { text: string }) {
  return <>{text.split('**').map((part, i) => (i % 2 ? <strong key={i} className="text-white">{part}</strong> : part))}</>
}

export default function AIButton() {
  const [open, setOpen] = useState(false)
  // Conversation lives for the browser session, so closing the drawer doesn't lose it
  const [turns, setTurns] = useState<Turn[]>([])

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
        aria-label="AI Consultant"
      >
        <Sparkles className="w-5 h-5 text-white" />
      </button>

      {/* Portaled to <body>: the header's backdrop-filter/transform would otherwise
          become the containing block for this fixed drawer and squash it into the header row */}
      {open && createPortal(<ConsultantDrawer turns={turns} setTurns={setTurns} onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}

function ConsultantDrawer({ turns, setTurns, onClose }: {
  turns: Turn[]
  setTurns: React.Dispatch<React.SetStateAction<Turn[]>>
  onClose: () => void
}) {
  const focus = useAIFocus()
  // Snapshot the stock on screen when the drawer opens
  const [focusTicker] = useState(focus?.ticker && /^[A-Z.]{1,6}$/.test(focus.ticker) ? focus.ticker : null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [allowance, setAllowance] = useState<Allowance | null>(null)
  const [limitHit, setLimitHit] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/consultant').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.allowance) { setAllowance(d.allowance); setLimitHit(d.allowance.remaining <= 0) }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [turns])

  async function ask(question: string) {
    const q = question.trim()
    if (!q || streaming || limitHit) return
    setInput('')
    const history: Turn[] = [...turns, { role: 'user', content: q }]
    setTurns([...history, { role: 'assistant', content: '' }])
    setStreaming(true)

    try {
      const res = await fetch('/api/consultant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, focus: focusTicker }),
      })
      if (res.status === 402) {
        const d = await res.json()
        setAllowance(d.allowance)
        setLimitHit(true)
        setTurns(history.slice(0, -1)) // drop the unanswered question; it wasn't counted
        setInput(q)
        setStreaming(false)
        return
      }
      if (!res.ok || !res.body) throw new Error(String(res.status))

      const remaining = res.headers.get('X-Questions-Remaining')
      if (remaining !== null) setAllowance(a => a ? { ...a, remaining: Number(remaining), used: a.limit - Number(remaining) } : a)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let answer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        answer += decoder.decode(value, { stream: true })
        setTurns([...history, { role: 'assistant', content: answer }])
      }
    } catch {
      setTurns([...history, { role: 'assistant', content: 'Couldn’t reach the consultant. Check your connection and try again.' }])
    }
    setStreaming(false)
  }

  const starters = focusTicker
    ? [`What's going on with $${focusTicker} today?`, `How is MarketJump calling $${focusTicker}?`, ...STARTERS.slice(0, 2)]
    : STARTERS
  const last = turns[turns.length - 1]

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-3xl flex flex-col"
        style={{
          background: '#0d1422',
          border: '1px solid rgba(109,40,217,0.3)',
          borderBottom: 'none',
          height: '88dvh',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-none px-5 pt-3 pb-3 border-b border-[#2a2a3a]">
          <div className="w-10 h-1 rounded-full bg-[#2a2a3a] mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1B3066, #6d28d9)' }}>
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-white font-black text-base leading-tight">AI Consultant</div>
                <div className="text-[#6b7280] text-[10px] uppercase tracking-wider">Knows your calls · tuned to your tier</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {allowance && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{
                  color: allowance.plan === 'pro' ? '#C9A84C' : '#a78bfa',
                  background: allowance.plan === 'pro' ? 'rgba(201,168,76,0.12)' : 'rgba(109,40,217,0.15)',
                }}>
                  {allowance.plan === 'pro' ? 'PRO · ' : ''}{allowance.remaining} left this {allowance.windowLabel}
                </span>
              )}
              <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-full text-[#6b7280] hover:bg-white/5">✕</button>
            </div>
          </div>
        </div>

        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {turns.length === 0 && (
            <div className="py-2">
              <p className="text-[#9ca3af] text-sm mb-3">
                Ask about any stock, your open calls, or how markets work. I can see your MarketJump record, your Tracklist and what the community is calling.
              </p>
              <div className="flex flex-col gap-2">
                {starters.map(s => (
                  <button key={s} onClick={() => ask(s)} disabled={limitHit}
                    className="text-left text-sm text-[#d1d5db] px-3 py-2 rounded-xl border border-[#2a2a3a] bg-[#12121a] active:scale-[0.98] transition-transform disabled:opacity-40">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t, i) => t.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-br-md text-sm text-white whitespace-pre-wrap" style={{ background: '#6d28d9' }}>{t.content}</div>
            </div>
          ) : (
            <div key={i} className="max-w-[95%] text-sm text-[#d1d5db] leading-relaxed whitespace-pre-wrap">
              {t.content ? <Formatted text={t.content} /> : (
                <span className="inline-flex items-center gap-2 text-[#6b7280]">
                  <span className="w-2 h-2 rounded-full bg-[#a78bfa] animate-pulse" /> Analyzing your MarketJump data…
                </span>
              )}
            </div>
          ))}

          {/* Out of questions */}
          {limitHit && allowance && (
            <div className="rounded-2xl p-4 border border-[#C9A84C]/30" style={{ background: 'rgba(201,168,76,0.06)' }}>
              <div className="text-[#C9A84C] text-xs font-black uppercase tracking-wider mb-1">
                {allowance.plan === 'pro' ? 'Monthly limit reached' : 'Free questions used'}
              </div>
              <p className="text-[#d1d5db] text-sm mb-2">
                {allowance.plan === 'pro'
                  ? `You've used all ${allowance.limit} Pro questions this month.`
                  : `You've used your ${allowance.limit} free questions this week.`}
                {allowance.resetsAt && ` More unlock ${new Date(allowance.resetsAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}.`}
              </p>
              {allowance.plan === 'free' && (
                <p className="text-[#9ca3af] text-xs">
                  <span className="text-white font-bold">MarketJump Pro</span> · $20/month · 200 questions a month, all built on your own calls and the MarketJump community. Coming soon.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={e => { e.preventDefault(); ask(input) }} className="flex-none flex gap-2 px-5 pt-3 border-t border-[#2a2a3a]">
          <input
            value={input}
            onChange={e => setInput(e.target.value.slice(0, 2000))}
            placeholder={limitHit ? 'Out of questions for now' : focusTicker ? `Ask about $${focusTicker} or anything else…` : 'Ask the consultant…'}
            disabled={limitHit}
            className="flex-1 min-w-0 bg-[#12121a] border border-[#2a2a3a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#4b5563] focus:outline-none focus:border-[#6d28d9] disabled:opacity-50"
          />
          <button type="submit" disabled={streaming || limitHit || !input.trim()}
            className="px-4 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ background: '#6d28d9' }}>
            {streaming && last?.role === 'assistant' ? '…' : 'Ask'}
          </button>
        </form>
      </div>
    </div>
  )
}
