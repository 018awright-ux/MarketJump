'use client'

import { useState, useRef, useEffect } from 'react'
import type { VideoPost } from '@/lib/types'
import LevelBadge from './LevelBadge'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

interface VideoCardProps {
  post: VideoPost
  onBullish: () => void
  onBearish: () => void
  onJump?: () => void
  onDeleted?: () => void
  userId?: string | null
  // Legacy optional props kept for Tracklist
  onTrack?: () => void
  tracked?: boolean
}

export default function VideoCard({ post, onBullish, onBearish, onDeleted, userId }: VideoCardProps) {
  const [clipIndex, setClipIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [videoError, setVideoError] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const swipeStartX = useRef(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const clips = post.videos ?? []
  const currentClip = clips[clipIndex]
  const total = clips.length

  function handleSwipeStart(x: number) { swipeStartX.current = x; setIsDragging(true) }
  function handleSwipeMove(x: number) { if (isDragging) setDragX(x - swipeStartX.current) }
  function handleSwipeEnd() {
    setIsDragging(false)
    if (dragX > 80) {
      // Swipe right: navigate to previous clip if available, otherwise bullish
      if (total > 1 && clipIndex > 0) { setDragX(0); goClip(clipIndex - 1) }
      else { setSwipeDir('right'); setTimeout(() => { setSwipeDir(null); setDragX(0); onBullish() }, 380) }
    } else if (dragX < -80) {
      // Swipe left: navigate to next clip if available, otherwise bearish
      if (total > 1 && clipIndex < total - 1) { setDragX(0); goClip(clipIndex + 1) }
      else { setSwipeDir('left'); setTimeout(() => { setSwipeDir(null); setDragX(0); onBearish() }, 380) }
    } else {
      setDragX(0)
    }
  }

  useEffect(() => {
    setClipIndex(0)
    setProgress(0)
    setPlaying(false)
    setVideoError(false)
    setImgError(false)
  }, [post.id])

  useEffect(() => {
    setImgError(false)
    setVideoError(false)
    const vid = videoRef.current
    if (!vid) return
    vid.load()
    if (playing) vid.play().catch(() => {})
  }, [clipIndex])

  function togglePlay() {
    const vid = videoRef.current
    if (!vid) return
    if (vid.paused) {
      vid.play().then(() => setPlaying(true)).catch(() => {
        // Play rejection (e.g. iOS policy) doesn't mean video is broken — don't show error
        setPlaying(false)
      })
    } else {
      vid.pause()
      setPlaying(false)
    }
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

  async function handleDelete() {
    setDeleting(true)
    try {
      await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
      setShowDeleteConfirm(false)
      onDeleted?.()
    } catch {
      setDeleting(false)
    }
  }

  // Fixed-position overlay so the card's touch-none / swipe handlers don't eat button taps
  function DeleteConfirmOverlay() {
    return (
      <div
        className="fixed inset-0 z-[200] flex flex-col items-center justify-end"
        style={{ background: 'rgba(0,0,0,0.75)' }}
        onClick={() => setShowDeleteConfirm(false)}
      >
        <div
          className="w-full max-w-lg px-5 pb-10 pt-6 flex flex-col gap-3 rounded-t-3xl"
          style={{ background: '#0d1422', borderTop: '1px solid rgba(201,168,76,0.2)' }}
          onClick={e => e.stopPropagation()}
        >
          <p className="text-white font-bold text-center text-base">Delete this post?</p>
          <p className="text-[#6b7280] text-xs text-center">This can&apos;t be undone.</p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full py-3 rounded-2xl font-black text-white text-sm active:scale-95 transition-all disabled:opacity-50"
            style={{ background: '#FF3B30' }}
          >
            {deleting ? 'Deleting…' : 'Yes, Delete'}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            disabled={deleting}
            className="w-full py-3 rounded-2xl font-bold text-[#6b7280] text-sm active:scale-95 transition-all"
            style={{ background: 'rgba(30,45,74,0.6)', border: '1px solid rgba(30,45,74,0.8)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const isOwner = userId && post.user_id && userId === post.user_id
  const isUp = post.stance === 'bullish'
  const isDown = post.stance === 'bearish'
  const bull = post.bull_votes + post.bear_votes > 0
    ? Math.round((post.bull_votes / (post.bull_votes + post.bear_votes)) * 100)
    : 50

  // ── Text-only card (no media attached) ──────────────────────────────────────
  if (clips.length === 0) {
    return (
      <div
        className={`relative flex-1 rounded-3xl border border-[#C9A84C]/20 overflow-hidden flex flex-col backdrop-blur-md touch-none select-none cursor-grab active:cursor-grabbing
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
        {/* Delete confirm — fixed overlay so card touch handlers don't interfere */}
        {showDeleteConfirm && <DeleteConfirmOverlay />}

        {/* Swipe overlays */}
        {isDragging && dragX > 30 && (
          <div className="absolute inset-0 rounded-3xl bg-[#00C805]/15 border-2 border-[#00C805] z-20 pointer-events-none flex items-center justify-center">
            <span className="text-[#00C805] font-black text-2xl tracking-widest -rotate-6" style={{ textShadow: '0 0 20px #00C805' }}>BULLISH</span>
          </div>
        )}
        {isDragging && dragX < -30 && (
          <div className="absolute inset-0 rounded-3xl bg-[#FF3B30]/15 border-2 border-[#FF3B30] z-20 pointer-events-none flex items-center justify-center">
            <span className="text-[#FF3B30] font-black text-2xl tracking-widest rotate-6" style={{ textShadow: '0 0 20px #FF3B30' }}>BEARISH</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 flex flex-col p-5">
          {/* Header row: stance + ticker + delete */}
          <div className="flex items-center justify-between mb-4">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              isUp ? 'bg-[#00C805]/20 text-[#00C805] border border-[#00C805]/40' :
              isDown ? 'bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/40' :
              'bg-white/10 text-white border border-white/20'
            }`}>
              {isUp ? '🐂 Bullish' : isDown ? '🐻 Bearish' : '⚖️ Neutral'}
            </span>
            <div className="flex items-center gap-2">
              {post.ticker && post.ticker !== 'GENERAL' && (
                <span className="text-[#C9A84C] font-black text-lg">${post.ticker}</span>
              )}
              {isOwner && (
                <button
                  onClick={e => { e.stopPropagation(); setShowDeleteConfirm(true) }}
                  className="text-[#4b5563] text-xl leading-none px-1 active:text-[#FF3B30] transition-colors"
                >
                  ···
                </button>
              )}
            </div>
          </div>

          {/* Author */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#1e2d4a] flex items-center justify-center text-sm font-bold text-[#C9A84C]">
              {post.author?.username?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-white text-sm font-bold">{post.author?.username ?? 'Unknown'}</span>
                {post.author?.level && <LevelBadge level={post.author.level} />}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {post.created_at && <span className="text-[#4b5563] text-[10px]">{timeAgo(post.created_at)}</span>}
                <span className="text-[#6b7280] text-[10px]">{post.view_count} views</span>
              </div>
            </div>
          </div>

          {/* Caption — big and readable */}
          {post.caption && (
            <p className="text-white text-base leading-relaxed flex-1">{post.caption}</p>
          )}
        </div>

        {/* Sentiment bar */}
        <div className="px-5 pb-5 border-t border-[#1e2d4a] pt-4">
          <div className="flex items-center gap-2">
            <span className="text-[#00C805] text-xs font-bold">🐂 {bull}%</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-[#FF3B30]/30">
              <div className="h-full bg-[#00C805] rounded-full" style={{ width: `${bull}%` }} />
            </div>
            <span className="text-[#FF3B30] text-xs font-bold">{100 - bull}% 🐻</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`relative flex-1 rounded-3xl border border-[#C9A84C]/20 overflow-hidden flex flex-col backdrop-blur-md touch-none select-none cursor-grab active:cursor-grabbing
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

      {/* Media player — handles both images and videos */}
      <div
        className="relative flex-1 bg-black min-h-0 overflow-hidden"
        onClick={e => {
          e.stopPropagation()
          if (isDragging) return
          if (currentClip?.media_type === 'image' && total > 1) {
            // Tap left half = prev clip, tap right half = next clip (Stories-style)
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            const x = e.clientX - rect.left
            goClip(x < rect.width / 2 ? Math.max(0, clipIndex - 1) : Math.min(total - 1, clipIndex + 1))
          } else if (currentClip?.media_type !== 'image') {
            togglePlay()
          }
        }}
      >
        {currentClip?.media_type === 'image' ? (
          // ── Image clip ──
          imgError ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <span className="text-3xl">⚠️</span>
              <span className="text-[#6b7280] text-xs text-center px-4">Image unavailable</span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentClip.public_url}
              className="w-full h-full object-cover"
              alt="Post image"
              onError={() => setImgError(true)}
            />
          )
        ) : currentClip && !videoError ? (
          // ── Video clip ──
          <video
            ref={videoRef}
            src={currentClip.public_url}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onError={() => setVideoError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            {videoError ? (
              <>
                <span className="text-3xl">⚠️</span>
                <span className="text-[#6b7280] text-xs text-center px-4">Video unavailable</span>
              </>
            ) : (
              <span className="text-[#6b7280] text-sm">No media</span>
            )}
          </div>
        )}

        {/* Play/pause overlay — only for videos */}
        {currentClip?.media_type !== 'image' && !playing && (
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

        {/* Ticker — hidden for general/untagged posts */}
        {post.ticker && post.ticker !== 'GENERAL' && (
          <div className="absolute top-3 right-3">
            <span className="text-[#C9A84C] font-black text-lg">${post.ticker}</span>
          </div>
        )}

        {/* Clip progress bars — one per clip */}
        {total > 1 && (
          <div className="absolute top-10 left-3 right-3 flex gap-1" onTouchStart={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
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

        {/* TikTok-style seekable progress bar — single clip */}
        {total === 1 && currentClip?.media_type !== 'image' && (
          <div
            className="absolute bottom-0 left-0 right-0 h-2 bg-white/20 cursor-pointer z-20"
            onClick={e => {
              e.stopPropagation()
              const rect = e.currentTarget.getBoundingClientRect()
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
              if (videoRef.current && videoRef.current.duration) {
                videoRef.current.currentTime = ratio * videoRef.current.duration
                setProgress(ratio)
              }
            }}
            onTouchStart={e => e.stopPropagation()}
            onTouchMove={e => {
              e.stopPropagation()
              const touch = e.touches[0]
              const rect = e.currentTarget.getBoundingClientRect()
              const ratio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width))
              if (videoRef.current && videoRef.current.duration) {
                videoRef.current.currentTime = ratio * videoRef.current.duration
                setProgress(ratio)
              }
            }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="h-full bg-white rounded-full" style={{ width: `${progress * 100}%`, transition: 'none' }} />
          </div>
        )}

        {/* Clip counter */}
        {total > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/60 rounded-full px-2 py-0.5 text-[10px] text-white font-mono">
            {clipIndex + 1}/{total}
          </div>
        )}
      </div>

      {/* Delete confirm overlay */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-end rounded-3xl overflow-hidden"
          style={{ background: 'rgba(8,12,20,0.85)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full px-5 pb-8 pt-6 flex flex-col gap-3"
            style={{ background: '#0d1422', borderTop: '1px solid rgba(201,168,76,0.2)' }}>
            <p className="text-white font-bold text-center text-base">Delete this post?</p>
            <p className="text-[#6b7280] text-xs text-center">This can&apos;t be undone.</p>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full py-3 rounded-2xl font-black text-white text-sm active:scale-95 transition-all disabled:opacity-50"
              style={{ background: '#FF3B30' }}
            >
              {deleting ? 'Deleting…' : 'Yes, Delete'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
              className="w-full py-3 rounded-2xl font-bold text-[#6b7280] text-sm active:scale-95 transition-all"
              style={{ background: 'rgba(30,45,74,0.6)', border: '1px solid rgba(30,45,74,0.8)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Info bar */}
      <div className="px-4 py-3 border-t border-[#1e2d4a]">
        {/* Author */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-[#1e2d4a] flex items-center justify-center text-xs font-bold text-[#C9A84C]">
            {post.author?.username?.[0]?.toUpperCase() ?? '?'}
          </div>
          <span className="text-white text-sm font-bold">{post.author?.username ?? 'Unknown'}</span>
          {post.author?.level && <LevelBadge level={post.author.level} />}
          <div className="ml-auto flex items-center gap-2">
            {post.created_at && (
              <span className="text-[#4b5563] text-[10px]">{timeAgo(post.created_at)}</span>
            )}
            <span className="text-[#6b7280] text-xs">{post.view_count} views</span>
            <span className="flex items-center gap-0.5 text-[#6b7280] text-xs">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {post.comment_count}
            </span>
            {isOwner && (
              <button
                onClick={e => { e.stopPropagation(); setShowDeleteConfirm(true) }}
                className="text-[#4b5563] text-base leading-none px-1 active:text-[#FF3B30] transition-colors"
              >
                ···
              </button>
            )}
          </div>
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

    </div>
  )
}
