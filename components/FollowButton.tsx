'use client'

import Link from 'next/link'
import { useFollowState, toggleFollow } from '@/lib/followStore'

interface FollowButtonProps {
  targetId: string
  // Called after a successful toggle with +1 (followed) or -1 (unfollowed)
  onChange?: (delta: 1 | -1) => void
  className?: string
  // 'sm' = compact pill for list rows, comments and feed author lines
  size?: 'full' | 'sm'
}

export default function FollowButton({ targetId, onChange, className = '', size = 'full' }: FollowButtonProps) {
  const { ready, viewerId, isFollowing, busy } = useFollowState(targetId)

  async function toggle(e: React.MouseEvent) {
    // Rows and video cards are often tappable themselves — don't trigger them
    e.preventDefault()
    e.stopPropagation()
    const wasFollowing = isFollowing
    if (await toggleFollow(targetId)) onChange?.(wasFollowing ? -1 : 1)
  }

  if (size === 'sm') {
    // Own row, logged out, or still loading: show nothing rather than a jumpy placeholder
    if (!ready || !viewerId || viewerId === targetId) return null
    return (
      <button
        onClick={toggle}
        disabled={busy}
        className={`px-3 py-1 rounded-full text-[11px] font-black transition-colors disabled:opacity-50 flex-shrink-0 ${
          isFollowing ? 'border border-[#C9A84C] text-[#C9A84C]' : 'text-black'
        } ${className}`}
        style={!isFollowing ? { background: 'linear-gradient(135deg, #C9A84C, #e8c96d)' } : {}}
      >
        {isFollowing ? 'Following' : 'Follow'}
      </button>
    )
  }

  if (!ready) {
    return <div className={`w-full py-2.5 rounded-xl bg-[#1e2d4a]/40 animate-pulse ${className}`} style={{ height: 40 }} />
  }

  // Own profile — nothing to follow
  if (viewerId === targetId) return null

  // Logged out (public brand page) — send to login
  if (!viewerId) {
    return (
      <Link
        href="/login"
        className={`block w-full py-2.5 rounded-xl text-sm font-black text-center text-black ${className}`}
        style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96d)' }}
      >
        Log in to Follow
      </Link>
    )
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`w-full py-2.5 rounded-xl text-sm font-black transition-colors disabled:opacity-50 ${
        isFollowing
          ? 'border border-[#C9A84C] text-[#C9A84C] bg-transparent'
          : 'text-black'
      } ${className}`}
      style={!isFollowing ? { background: 'linear-gradient(135deg, #C9A84C, #e8c96d)' } : {}}
    >
      {isFollowing ? '✓ Following' : 'Follow Brand'}
    </button>
  )
}
