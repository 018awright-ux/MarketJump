import { useState, useRef } from 'react'

const THRESHOLD = 60   // px to trigger refresh
const MAX_PULL  = 80   // px cap on drag distance

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing]     = useState(false)
  const touchStartY  = useRef(0)
  const scrollRef    = useRef<HTMLDivElement>(null)

  function onTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
  }

  function onTouchMove(e: React.TouchEvent) {
    if (refreshing) return
    // Only pull when scroll container is already at the top
    const el = scrollRef.current
    if (el && el.scrollTop > 2) return
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0) setPullDistance(Math.min(dy, MAX_PULL))
  }

  async function onTouchEnd() {
    if (pullDistance > THRESHOLD) {
      setPullDistance(0)
      setRefreshing(true)
      await onRefresh()
      setRefreshing(false)
    } else {
      setPullDistance(0)
    }
  }

  const isActive = pullDistance > 0 || refreshing

  return {
    scrollRef,
    refreshing,
    pullDistance,
    isActive,
    touchHandlers: { onTouchStart, onTouchMove, onTouchEnd } as React.HTMLAttributes<HTMLElement>,
  }
}
