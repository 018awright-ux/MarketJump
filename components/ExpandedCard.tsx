'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { JumpCard as JumpCardType, UserLevel } from '@/lib/types'
import MomentumMeter from './MomentumMeter'
import SourceBadge from './SourceBadge'

interface ExpandedCardProps {
  card: JumpCardType
  level: UserLevel
  onClose: () => void
  onBullish: () => void
  onBearish: () => void
  onTrack: () => void
  onJump: () => void
  tracked?: boolean
}

export default function ExpandedCard({
  card, level, onClose, onBullish, onBearish, onTrack, onJump, tracked = false
}: ExpandedCardProps) {
  const [aiText, setAiText] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  const isPositive = (card.change_percent ?? 0) >= 0
  const hasPrice = card.price != null && card.card_type !== 'macro'

  // Portal requires DOM — wait for mount
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => { fetchAI() }, [card.id])

  async function fetchAI() {
    setAiLoading(true)
    setAiText('')
    setAiError(null)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardType: card.card_type,
          ticker: card.ticker,
          headline: card.headline,
          summary: card.summary,
          changePercent: card.change_percent,
          source: card.source,
          level,
        }),
      })
      const data = await res.json()
      if (data.analysis) {
        setAiText(data.analysis)
      } else {
        setAiError(data.error ?? 'unavailable')
      }
    } catch {
      setAiError('unavailable')
    }
    setAiLoading(false)
  }

  if (!mounted) return null

  // Portal renders directly on document.body — bypasses main's z-10 stacking
  // context so z-[999] correctly sits above everything including BottomNav (z-50)
  return createPortal(
    <div
      className="fixed inset-0 z-[999] flex flex-col"
      style={{ background: 'rgba(10,10,15,0.98)' }}
    >
      {/* ── Header — safe-area aware so X is always visible on notched phones ── */}
      <div
        className="flex-none flex items-center justify-between px-5 border-b border-[#1e2d4a]"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: '12px' }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-white">{card.ticker}</span>
            {hasPrice && (
              <span className={`text-sm font-bold ${isPositive ? 'text-[#00C805]' : 'text-[#FF3B30]'}`}>
                ${card.price?.toFixed(2)} ({isPositive ? '+' : ''}{card.change_percent?.toFixed(2)}%)
              </span>
            )}
          </div>
          <SourceBadge source={card.source} sourceName={card.source_name} />
        </div>
        {/* Close button — always rendered, high contrast */}
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full active:scale-90 transition-transform flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Headline + summary */}
        <div className="p-5 border-b border-[#1e2d4a]">
          <h2 className="text-white font-bold text-base leading-snug mb-2">{card.headline}</h2>
          <p className="text-[#9ca3af] text-sm leading-relaxed">{card.summary}</p>
        </div>

        {/* Momentum */}
        <div className="p-5 border-b border-[#1e2d4a]">
          <MomentumMeter bull={card.bull_percent} bear={card.bear_percent} />
        </div>

        {/* AI Analysis */}
        <div className="p-5 border-b border-[#1e2d4a]">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[#00C805] font-bold text-sm">⚡ AI Analysis</span>
            <span className="text-[10px] text-[#6b7280] bg-[#111827] px-2 py-0.5 rounded-full uppercase tracking-wider">
              {level}
            </span>
          </div>
          {aiLoading ? (
            <div className="space-y-2">
              <div className="h-3 bg-[#111827] rounded animate-pulse w-full" />
              <div className="h-3 bg-[#111827] rounded animate-pulse w-4/5" />
              <div className="h-3 bg-[#111827] rounded animate-pulse w-5/6" />
              <div className="h-3 bg-[#111827] rounded animate-pulse w-3/4" />
            </div>
          ) : aiError ? (
            <div className="flex flex-col items-center gap-2 py-3 text-center">
              <span className="text-2xl">⚡</span>
              <p className="text-[#6b7280] text-xs leading-relaxed">
                {aiError === 'no_key' || aiError === 'no_credits'
                  ? 'AI analysis is being configured. Check back shortly.'
                  : 'Analysis temporarily unavailable. Tap to retry.'}
              </p>
              {aiError !== 'no_key' && aiError !== 'no_credits' && (
                <button
                  onClick={fetchAI}
                  className="text-[#C9A84C] text-xs font-bold border border-[#C9A84C]/30 px-3 py-1 rounded-full"
                >
                  Retry
                </button>
              )}
            </div>
          ) : (
            <p className="text-[#d1d5db] text-sm leading-relaxed whitespace-pre-wrap">{aiText}</p>
          )}
        </div>

        {/* Disclaimer */}
        <div className="px-5 py-3">
          <p className="text-[#4b5563] text-xs italic">
            Public information and opinion only. Not financial advice.
          </p>
        </div>
      </div>

      {/* ── Action bar — no JUMP button, safe-area bottom padding ── */}
      <div
        className="flex-none px-5 pt-4 border-t border-[#1e2d4a]"
        style={{
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          background: 'rgba(10,10,15,0.99)',
        }}
      >
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={onBullish}
            className="flex flex-col items-center gap-1.5 bg-[#00C805]/10 border border-[#00C805]/30 rounded-2xl py-4 active:scale-95 transition-transform"
          >
            <span className="text-2xl">🐂</span>
            <span className="text-[#00C805] text-xs font-bold">Bullish</span>
          </button>
          <button
            onClick={onBearish}
            className="flex flex-col items-center gap-1.5 bg-[#FF3B30]/10 border border-[#FF3B30]/30 rounded-2xl py-4 active:scale-95 transition-transform"
          >
            <span className="text-2xl">🐻</span>
            <span className="text-[#FF3B30] text-xs font-bold">Bearish</span>
          </button>
          <button
            onClick={onTrack}
            className={`flex flex-col items-center gap-1.5 border rounded-2xl py-4 active:scale-95 transition-transform ${
              tracked ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-[#111827] border-[#1e2d4a]'
            }`}
          >
            <span className="text-2xl">{tracked ? '⭐' : '☆'}</span>
            <span className={`text-xs font-bold ${tracked ? 'text-yellow-400' : 'text-[#6b7280]'}`}>Track</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
