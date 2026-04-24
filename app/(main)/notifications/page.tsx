'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PullIndicator from '@/components/PullIndicator'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'

type NotifType = 'prediction' | 'follow' | 'alert' | 'market'

interface Notification {
  id: string
  type: NotifType
  title: string
  subtitle: string
  time: string
  unread: boolean
  href: string
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'prediction', title: 'AAPL prediction resolved ✅', subtitle: 'Your bullish call on AAPL was correct! +45 pts', time: '2m ago', unread: true, href: '/profile' },
  { id: '2', type: 'follow', title: 'BullishBanker followed you', subtitle: 'Analyst · 847 accuracy score', time: '15m ago', unread: true, href: '/profile/1' },
  { id: '3', type: 'prediction', title: 'TSLA prediction resolved ❌', subtitle: 'Your bearish call on TSLA was incorrect. -20 pts', time: '1h ago', unread: false, href: '/profile' },
  { id: '4', type: 'alert', title: 'NVDA up +5.2% today', subtitle: 'NVDA is in your Tracklist and spiking', time: '2h ago', unread: false, href: '/watchlist' },
  { id: '5', type: 'follow', title: 'SharkTrader started following you', subtitle: 'Shark · 92.3% accuracy · 1,204 score', time: '3h ago', unread: false, href: '/profile/2' },
  { id: '6', type: 'market', title: 'Fed announcement in 30 mins', subtitle: 'Interest rate decision — watch for volatility', time: '4h ago', unread: false, href: '/explore' },
  { id: '7', type: 'prediction', title: 'AMZN prediction resolves tomorrow', subtitle: 'Your bullish call on AMZN expires in 24h', time: '5h ago', unread: false, href: '/profile' },
]

type FilterKey = 'all' | 'predictions' | 'follows' | 'alerts'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'predictions', label: 'Predictions' },
  { key: 'follows',     label: 'Follows' },
  { key: 'alerts',      label: 'Alerts' },
]

function getIcon(type: NotifType): string {
  switch (type) {
    case 'prediction': return '🎯'
    case 'follow':     return '👥'
    case 'alert':      return '⚡'
    case 'market':     return '📊'
  }
}

function filterNotifications(notifications: Notification[], filter: FilterKey): Notification[] {
  switch (filter) {
    case 'all':         return notifications
    case 'predictions': return notifications.filter(n => n.type === 'prediction')
    case 'follows':     return notifications.filter(n => n.type === 'follow')
    case 'alerts':      return notifications.filter(n => n.type === 'alert' || n.type === 'market')
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS)
  const [loadedReal, setLoadedReal] = useState(false)

  const ptr = usePullToRefresh(async () => { await loadNotifications() })

  useEffect(() => { loadNotifications() }, [])

  async function loadNotifications() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, read, href, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error || !data) return
      if (data.length > 0) {
        const mapped: Notification[] = data.map(n => ({
          id: n.id,
          type: (n.type ?? 'prediction') as NotifType,
          title: n.title ?? '',
          subtitle: n.body ?? '',
          time: timeAgo(n.created_at),
          unread: !n.read,
          href: n.href ?? '/profile',
        }))
        setNotifications(mapped)
        setLoadedReal(true)
      }
    } catch { /* table may not exist yet — keep mock */ }
  }

  const unreadCount = notifications.filter(n => n.unread).length
  const filtered = filterNotifications(notifications, activeFilter)

  async function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })))
    if (loadedReal) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
        }
      } catch { /* ignore */ }
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-black text-black px-0.5"
                style={{ background: '#C9A84C' }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          <h1 className="text-xl font-black text-white">Notifications</h1>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs font-semibold" style={{ color: '#C9A84C' }}>
            Mark all read
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="px-5 pb-3 flex-shrink-0">
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {FILTERS.map(f => {
            const active = activeFilter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border transition-colors"
                style={active
                  ? { color: '#C9A84C', borderColor: '#C9A84C', background: 'rgba(201,168,76,0.1)' }
                  : { color: '#6b7280', borderColor: '#2a2a3a', background: 'transparent' }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Scrollable list */}
      <div
        ref={ptr.scrollRef}
        className="flex-1 overflow-y-auto px-5 pb-4"
        {...ptr.touchHandlers}
      >
        <PullIndicator pullDistance={ptr.pullDistance} refreshing={ptr.refreshing} />

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full pt-16 gap-3">
            <span className="text-5xl">🔔</span>
            <p className="text-[#6b7280] text-sm font-medium">No notifications here</p>
            <p className="text-[#4b5563] text-xs">Pull down to refresh</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(notif => (
              <button
                key={notif.id}
                onClick={() => router.push(notif.href)}
                className="w-full text-left rounded-2xl border p-4 flex items-center gap-3 transition-colors active:opacity-80"
                style={{ background: '#12121a', borderColor: '#2a2a3a' }}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm leading-snug truncate">{notif.title}</p>
                  <p className="text-[#6b7280] mt-0.5 leading-snug line-clamp-1" style={{ fontSize: '12px' }}>
                    {notif.subtitle}
                  </p>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                  <span className="text-[#6b7280]" style={{ fontSize: '10px' }}>{notif.time}</span>
                  {notif.unread && (
                    <span className="block rounded-full" style={{ width: '6px', height: '6px', background: '#C9A84C' }} />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
