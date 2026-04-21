'use client'

import { useState, useRef, useEffect } from 'react'
import type { VideoPost } from '@/lib/types'
import LevelBadge from './LevelBadge'

interface VideoCardProps {
  post: VideoPost
  onBullish: () => void
  onBearish: () => void
  onTrack: () => void
  onJump: () => void
  tracked?: boolean
}

export default function VideoCard({ post, onBullish, onBearish, onTrack, onJump, tracked = false }: VideoCardProps) {
  const [clipIndex, setClipIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragX, setDragX] = useState(0)
  const swipeStartX = useRef(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const clips = post.videos ?? []
  const currentClip = clips[clipIndex]
  const total = clips.length

  function handleSwipeStart(x: number) { swipeStartX.current = x; setIsDragging(true) }
  function handleSwipeMove(x: number) { if (isDragging) setDragX(x - swipeStartX.current) }
  function handleSwipeEnd() {
    setIsDragging(false)
    if (dragX > 80) { setSwipeDir('right'); setTimeout(() => { setSwipeDir(null); setDragX(0); onBullish() }, 380) }
    else if (dragX < -80) { setSwipeDir('left'); setTimeout(() => { setSwipeDir(null); setDragX(0); onBearish() }, 380) }
    else setDragX(0)
  }

  useEffect(() => {
    setClipIndex(0)
    setProgress(0)
    setPlaying(false)
  }, [post.id])

  useEffect(() => {
    const vid = videoRef.current
    if (!vid) return
    vid.load()
    if (playing) vid.play().catch(() => {})
  }, [clipIndex])

  function togglePlay() {
    const vid = videoRef.current
    if (!vid) return
    if (vid.paused) { vid.play(); setPlaying(true) }
    else { vid.pause(); setPlaying(false) }
  }

  function handleTimeUpdate() {
    const vid = videoRef.current
    if (!vid || !vid.duration) return
    setProgress(vid.currentTime / vid.duration)
  }

  function handleEnded() {
    if (clipIndex < total - 1) {
      setClipIndex(i => i + 1)
      setPlaying(true)
    } else {
      setPlaying(false)
      setProgress(1)
    }
  }

  function goClip(i: number) {
    setClipIndex(i)
    setProgress(0)
    if (playing && videoRef.current) videoRef.current.play().catch(() => {})
  }

  const isUp = post.stance === 'bullish'
  const isDown = post.stance === 'bearish'
  const bull = post.bull_votes + post.bear_votes > 0
    ? Math.round((post.bull_votes / (post.bull_votes + post.bear_votes)) * 100)
    : 50

  return (
    <div
      className={`flex-1 rounded-3xl border border-[#C9A84C]/20 overflow-hidden flex flex-col backdrop-blur-md touch-none select-none cursor-grab active:cursor-grabbing
        ${swipeDir === 'right' ? 'animate-swipe-right' : ''}
        ${swipeDir === 'left' ? 'animate-swipe-left' : ''}
      `}
      style={{
        background: 'rgba(8,12,20,0.92)',
        transform: isDragging ? `translateX(${dragX}px) rotate(${dragX * 0.03}deg)` : undefined,
        transition: isDragging ? 'none' : 'transform 0.25s ease',
      }}
      onTouchStart={e => handleSwipeStart(e.touches[0].clientX)}
      onTouchMove={e => handleSwipeMove(e.touches[0].clientX)}
      onTouchEnd={handleSwipeEnd}
      onMouseDown={e => handleSwipeStart(e.clientX)}
      onMouseMove={e => handleSwipeMove(e.clientX)}
      onMouseUp={handleSwipeEnd}
      onMouseLeave={handleSwipeEnd}
    >
      {/* Swipe overlays */}
      {isDragging && dragX > 30 && (
        <div className="absolute inset-0 rounded-3xl bg-[#00C805]/15 border-2 border-[#00C805] z-20 pointer-events-none flex flex-col items-center justify-center gap-3">
          <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-12" style={{ filter: 'drop-shadow(0 0 20px #00C805)' }}>
            <ellipse cx="50" cy="68" rx="28" ry="18" fill="#00C805" />
            <circle cx="50" cy="42" r="22" fill="#00C805" />
            <path d="M28 30 Q14 10 22 4 Q30 0 34 18" fill="#00ff06" />
            <path d="M72 30 Q86 10 78 4 Q70 0 66 18" fill="#00ff06" />
            <circle cx="42" cy="38" r="4" fill="#fff" /><circle cx="58" cy="38" r="4" fill="#fff" />
            <circle cx="43" cy="39" r="2" fill="#000" /><circle cx="59" cy="39" r="2" fill="#000" />
            <ellipse cx="50" cy="52" rx="10" ry="7" fill="#00dd04" />
          </svg>
          <span className="text-[#00C805] font-black text-2xl tracking-widest -rotate-6" style={{ textShadow: '0 0 20px #00C805' }}>BULLISH</span>
        </div>
      )}
      {isDragging && dragX < -30 && (
        <div className="absolute inset-0 rounded-3xl bg-[#FF3B30]/15 border-2 border-[#FF3B30] z-20 pointer-events-none flex flex-col items-center justify-center gap-3">
          <svg viewBox="0 0 100 100" className="w-28 h-28 rotate-12" style={{ filter: 'drop-shadow(0 0 20px #FF3B30)' }}>
            <circle cx="32" cy="28" r="14" fill="#FF3B30" /><circle cx="68" cy="28" r="14" fill="#FF3B30" />
            <ellipse cx="50" cy="62" rx="32" ry="26" fill="#FF3B30" />
            <circle cx="50" cy="52" r="24" fill="#FF3B30" />
            <circle cx="30" cy="26" r="8" fill="#cc2a22" /><circle cx="70" cy="26" r="8" fill="#cc2a22" />
            <circle cx="42" cy="46" r="4" fill="#fff" /><circle cx="58" cy="46" r="4" fill="#fff" />
            <circle cx="43" cy="47" r="2" fill="#000" /><circle cx="59" cy="47" r="2" fill="#000" />
            <ellipse cx="50" cy="58" rx="12" ry="8" fill="#cc2a22" />
            <ellipse cx="44" cy="57" rx="3" ry="2" fill="#000" /><ellipse cx="56" cy="57" rx="3" ry="2" fill="#000" />
          </svg>
          <span className="text-[#FF3B30] font-black text-2xl tracking-widest rotate-6" style={{ textShadow: '0 0 20px #FF3B30' }}>BEARISH</span>
        </div>
      )}

      {/* Video player */}
      <div className="relative flex-1 bg-black min-h-0" onClick={e => { e.stopPropagation(); if (!isDragging) togglePlay() }}>
        {currentClip ? (
          <video
            ref={videoRef}
            src={currentClip.public_url}
            className="w-full h-full object-cover"
            playsInline
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[#6b7280] text-sm">No video</span>
          </div>
        )}

        {/* Play/pause overlay */}
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(8,12,20,0.7)', border: '2px solid rgba(201,168,76,0.4)' }}>
              <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Stance badge */}
        <div className="absolute top-3 left-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            isUp ? 'bg-[#00C805]/20 text-[#00C805] border border-[#00C805]/40' :
            isDown ? 'bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/40' :
            'bg-white/10 text-white border border-white/20'
          }`}>
            {isUp ? '🐂 Bullish' : isDown ? '🐻 Bearish' : '⚖️ Neutral'}
          </span>
        </div>

        {/* Ticker */}
        <div className="absolute top-3 right-3">
          <span className="text-[#C9A84C] font-black text-lg">${post.ticker}</span>
        </div>

        {/* Clip progress bars — one per clip */}
        {total > 1 && (
          <div className="absolute top-10 left-3 right-3 flex gap-1">
            {clips.map((_, i) => (
              <button key={i} className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/20" onClick={e => { e.stopPropagation(); goClip(i) }}>
                <div
                  className="h-full bg-white rounded-full transition-all"
                  style={{
                    width: i < clipIndex ? '100%' : i === clipIndex ? `${progress * 100}%` : '0%'
                  }}
                />
              </button>
            ))}
          </div>
        )}

        {/* Single clip progress */}
        {total === 1 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
            <div className="h-full bg-[#C9A84C] transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
        )}

        {/* Clip counter */}
        {total > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/60 rounded-full px-2 py-0.5 text-[10px] text-white font-mono">
            {clipIndex + 1}/{total}
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className="px-4 py-3 border-t border-[#1e2d4a]">
        {/* Author */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-[#1e2d4a] flex items-center justify-center text-xs font-bold text-[#C9A84C]">
            {post.author?.username?.[0]?.toUpperCase() ?? '?'}
          </div>
          <span className="text-white text-sm font-bold">{post.author?.username ?? 'Unknown'}</span>
          {post.author?.level && <LevelBadge level={post.author.level} />}
          <span className="text-[#6b7280] text-xs ml-auto">{post.view_count} views</span>
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="text-[#d1d5db] text-xs leading-relaxed mb-2 line-clamp-2">{post.caption}</p>
        )}

        {/* Momentum */}
        <div className="flex items-center gap-2">
          <span className="text-[#00C805] text-xs font-bold">🐂 {bull}%</span>
          <div className="flex-1 h-1 rounded-full overflow-hidden bg-[#FF3B30]/30">
            <div className="h-full bg-[#00C805] rounded-full" style={{ width: `${bull}%` }} />
          </div>
          <span className="text-[#FF3B30] text-xs font-bold">{100 - bull}% 🐻</span>
        </div>
      </div>

      {/* Action buttons — Track only; swipe left/right for bear/bull */}
      <div className="px-4 pb-3">
        <button
          onClick={onTrack}
          className="w-full flex items-center justify-center gap-2 border rounded-2xl py-3 active:scale-95"
          style={{
            background: tracked ? 'rgba(201,168,76,0.15)' : 'rgba(8,12,20,0.6)',
            borderColor: tracked ? 'rgba(201,168,76,0.5)' : 'rgba(30,45,74,0.8)',
          }}
        >
          <span className="text-xl">{tracked ? '⭐' : '☆'}</span>
          <span className={`text-sm font-bold ${tracked ? 'text-[#C9A84C]' : 'text-[#6b7280]'}`}>
            {tracked ? 'Tracked' : 'Track'}
          </span>
        </button>
      </div>

      {/* JUMP circle */}
      <div className="flex justify-center pb-4">
        <button
          onClick={onJump}
          className="w-20 h-20 rounded-full font-black text-sm tracking-widest transition-all active:scale-90 shadow-xl flex flex-col items-center justify-center gap-0.5"
          style={{
            background: 'linear-gradient(135deg, #1B3066 0%, #2a4a8a 50%, #C9A84C 100%)',
            color: '#fff',
            boxShadow: '0 0 24px rgba(201,168,76,0.35), 0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-[9px] font-black tracking-widest">JUMP</span>
        </button>
      </div>
    </div>
  )
}
