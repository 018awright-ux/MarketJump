'use client'

import { useRef, useState } from 'react'
import type { JumpCard as JumpCardType } from '@/lib/types'
import MomentumMeter from './MomentumMeter'
import SourceBadge from './SourceBadge'

interface JumpCardProps {
  card: JumpCardType
  onBullish: () => void
  onBearish: () => void
  onTrack: () => void
  onHold: () => void
  onJump: () => void
  tracked?: boolean
}

export default function JumpCard({
  card,
  onBullish,
  onBearish,
  onTrack,
  onHold,
  onJump,
  tracked = false,
}: JumpCardProps) {
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragX, setDragX] = useState(0)
  const startX = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)

  const isPositive = (card.change_percent ?? 0) >= 0
  const hasPrice = card.price != null && card.card_type !== 'macro'

  // ── Touch handlers ──────────────────────────────────────────────────────────
  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    setIsDragging(true)
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging) return
    setDragX(e.touches[0].clientX - startX.current)
  }
  function handleTouchEnd() {
    setIsDragging(false)
    commitSwipe()
  }

  // ── Mouse handlers (desktop testing) ───────────────────────────────────────
  function handleMouseDown(e: React.MouseEvent) {
    startX.current = e.clientX
    setIsDragging(true)
  }
  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging) return
    setDragX(e.clientX - startX.current)
  }
  function handleMouseUp() {
    if (!isDragging) return
    setIsDragging(false)
    commitSwipe()
  }
  function handleMouseLeave() {
    if (isDragging) {
      setIsDragging(false)
      commitSwipe()
    }
  }

  function commitSwipe() {
    if (dragX > 80) {
      setSwipeDir('right')
      setTimeout(() => { setSwipeDir(null); setDragX(0); onBullish() }, 380)
    } else if (dragX < -80) {
      setSwipeDir('left')
      setTimeout(() => { setSwipeDir(null); setDragX(0); onBearish() }, 380)
    } else {
      setDragX(0)
    }
  }

  const rotation = isDragging ? dragX * 0.04 : 0

  return (
    <div className="relative w-full h-full flex flex-col" ref={cardRef}>
      {/* Swipe overlays */}
      {isDragging && dragX > 30 && (
        <div className="absolute inset-0 rounded-3xl bg-[#00C805]/15 border-2 border-[#00C805] z-10 pointer-events-none flex flex-col items-center justify-center gap-3">
          <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-12" style={{ filter: 'drop-shadow(0 0 20px #00C805)' }}>
            {/* Bull icon — green */}
            <ellipse cx="50" cy="68" rx="28" ry="18" fill="#00C805" />
            <circle cx="50" cy="42" r="22" fill="#00C805" />
            {/* Horns */}
            <path d="M28 30 Q14 10 22 4 Q30 0 34 18" fill="#00ff06" />
            <path d="M72 30 Q86 10 78 4 Q70 0 66 18" fill="#00ff06" />
            {/* Eyes */}
            <circle cx="42" cy="38" r="4" fill="#fff" />
            <circle cx="58" cy="38" r="4" fill="#fff" />
            <circle cx="43" cy="39" r="2" fill="#000" />
            <circle cx="59" cy="39" r="2" fill="#000" />
            {/* Nose ring */}
            <ellipse cx="50" cy="52" rx="10" ry="7" fill="#00dd04" />
            <ellipse cx="50" cy="52" rx="6" ry="4" fill="#00C805" stroke="#00ff06" strokeWidth="1.5" fillOpacity={0} />
          </svg>
          <span className="text-[#00C805] font-black text-2xl tracking-widest -rotate-6"
            style={{ textShadow: '0 0 20px #00C805' }}>BULLISH</span>
        </div>
      )}
      {isDragging && dragX < -30 && (
        <div className="absolute inset-0 rounded-3xl bg-[#FF3B30]/15 border-2 border-[#FF3B30] z-10 pointer-events-none flex flex-col items-center justify-center gap-3">
          <svg viewBox="0 0 100 100" className="w-28 h-28 rotate-12" style={{ filter: 'drop-shadow(0 0 20px #FF3B30)' }}>
            {/* Bear icon — red */}
            <circle cx="32" cy="28" r="14" fill="#FF3B30" />
            <circle cx="68" cy="28" r="14" fill="#FF3B30" />
            <ellipse cx="50" cy="62" rx="32" ry="26" fill="#FF3B30" />
            <circle cx="50" cy="52" r="24" fill="#FF3B30" />
            {/* Ears */}
            <circle cx="30" cy="26" r="8" fill="#cc2a22" />
            <circle cx="70" cy="26" r="8" fill="#cc2a22" />
            {/* Eyes */}
            <circle cx="42" cy="46" r="4" fill="#fff" />
            <circle cx="58" cy="46" r="4" fill="#fff" />
            <circle cx="43" cy="47" r="2" fill="#000" />
            <circle cx="59" cy="47" r="2" fill="#000" />
            {/* Snout */}
            <ellipse cx="50" cy="58" rx="12" ry="8" fill="#cc2a22" />
            <ellipse cx="44" cy="57" rx="3" ry="2" fill="#000" />
            <ellipse cx="56" cy="57" rx="3" ry="2" fill="#000" />
          </svg>
          <span className="text-[#FF3B30] font-black text-2xl tracking-widest rotate-6"
            style={{ textShadow: '0 0 20px #FF3B30' }}>BEARISH</span>
        </div>
      )}

      {/* Swipe instruction hint — shown when not dragging */}
      {!isDragging && dragX === 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-center gap-2 opacity-40">
          <span className="text-[#00C805] text-[10px] font-bold">← Bearish</span>
          <span className="text-white text-[10px]">·</span>
          <span className="text-[#FF3B30] text-[10px] font-bold">Bullish →</span>
        </div>
      )}

      {/* Card */}
      <div
        className={`flex-1 rounded-3xl border border-[#C9A84C]/20 overflow-hidden flex flex-col touch-none select-none backdrop-blur-md cursor-grab active:cursor-grabbing
          ${swipeDir === 'right' ? 'animate-swipe-right' : ''}
          ${swipeDir === 'left' ? 'animate-swipe-left' : ''}
        `}
        style={{
          transform: isDragging ? `translateX(${dragX}px) rotate(${rotation}deg)` : undefined,
          background: 'rgba(8,12,20,0.88)',
          transition: isDragging ? 'none' : 'transform 0.25s ease, opacity 0.25s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Card header */}
        <div className="p-5 pb-3">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl font-black text-white">{card.ticker}</span>
                {card.company_name && (
                  <span className="text-[#6b7280] text-sm truncate max-w-[160px]">{card.company_name}</span>
                )}
              </div>
              <SourceBadge source={card.source} sourceName={card.source_name} />
            </div>
            {hasPrice && (
              <div className="text-right">
                <div className="text-xl font-bold text-white">${card.price?.toFixed(2)}</div>
                <div className={`text-sm font-bold ${isPositive ? 'text-[#00C805]' : 'text-[#FF3B30]'}`}>
                  {isPositive ? '+' : ''}{card.change_percent?.toFixed(2)}%
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
              card.card_type === 'stock' ? 'bg-[#40A9FF]/15 text-[#40A9FF]' :
              card.card_type === 'social' ? 'bg-[#F59E0B]/15 text-[#F59E0B]' :
              'bg-[#A855F7]/15 text-[#A855F7]'
            }`}>
              {card.card_type === 'stock' ? '📉 Stock' : card.card_type === 'social' ? '💬 Social' : '🌍 Macro'}
            </span>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 px-5 overflow-y-auto">
          <h3 className="text-white font-bold text-base leading-snug mb-3">{card.headline}</h3>
          <p className="text-[#9ca3af] text-sm leading-relaxed mb-3">{card.summary}</p>

          {/* Top User Signal pill */}
          {(() => {
            const bullPct = card.bull_percent ?? 50
            const bearPct = card.bear_percent ?? 50
            let label: string
            let color: string
            let bg: string
            if (bullPct >= 65) {
              label = '🏆 Top analysts leaning bullish'
              color = '#00C805'
              bg = 'rgba(0,200,5,0.10)'
            } else if (bearPct >= 55) {
              label = '📉 High-accuracy users bearish'
              color = '#FF3B30'
              bg = 'rgba(255,59,48,0.10)'
            } else {
              label = '⚡ Mixed signals from top traders'
              color = '#C9A84C'
              bg = 'rgba(201,168,76,0.10)'
            }
            return (
              <div
                className="inline-block rounded-full px-3 py-1 mb-1"
                style={{ background: bg, color, fontSize: '10px', fontWeight: 700, border: `1px solid ${color}30` }}
              >
                {label}
              </div>
            )
          })()}
        </div>

        {/* Momentum meter */}
        <div className="px-5 py-4">
          <MomentumMeter bull={card.bull_percent} bear={card.bear_percent} />
          {/* Live sentiment tag */}
          <div className="text-center text-[#6b7280] mt-1" style={{ fontSize: '10px' }}>
            Live sentiment from MarketJump users
          </div>
        </div>
      </div>

      {/* Action buttons — Track + Hold only; swipe handles bull/bear */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          onClick={onTrack}
          className="flex flex-col items-center gap-1 border rounded-2xl py-3 active:scale-95 backdrop-blur-md"
          style={{
            background: tracked ? 'rgba(201,168,76,0.15)' : 'rgba(8,12,20,0.6)',
            borderColor: tracked ? 'rgba(201,168,76,0.5)' : 'rgba(30,45,74,0.8)',
          }}
        >
          <span className="text-xl">{tracked ? '⭐' : '☆'}</span>
          <span className={`text-xs font-bold ${tracked ? 'text-[#C9A84C]' : 'text-[#6b7280]'}`}>
            {tracked ? 'Tracked' : 'Track'}
          </span>
        </button>

        <button
          onClick={onHold}
          className="flex flex-col items-center gap-1 border border-[#1e2d4a] rounded-2xl py-3 active:scale-95 backdrop-blur-md"
          style={{ background: 'rgba(8,12,20,0.6)' }}
        >
          <span className="text-xl">🔍</span>
          <span className="text-[#6b7280] text-xs font-bold">Deep Dive</span>
        </button>
      </div>

      {/* JUMP circle button — the brand centerpiece */}
      <div className="flex justify-center mt-3 mb-1">
        <button
          onClick={onJump}
          className="w-24 h-24 rounded-full transition-all active:scale-90 flex flex-col items-center justify-center gap-1 animate-jump-pulse"
          style={{
            background: 'linear-gradient(135deg, #1B3066 0%, #2a4a8a 50%, #C9A84C 100%)',
            color: '#fff',
            boxShadow: '0 0 32px rgba(201,168,76,0.4), 0 0 64px rgba(27,48,102,0.3)',
          }}
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-[10px] font-black tracking-widest">JUMP</span>
        </button>
      </div>
    </div>
  )
}
