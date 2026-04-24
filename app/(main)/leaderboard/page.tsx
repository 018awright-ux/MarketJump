'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import LevelBadge from '@/components/LevelBadge'
import PullIndicator from '@/components/PullIndicator'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import type { UserLevel } from '@/lib/types'

type Period = 'weekly' | 'monthly' | 'all_time'

interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  brand_name?: string | null
  level: UserLevel
  accuracy: number
  market_score: number
  total_predictions?: number
}

// ── Date helpers ─────────────────────────────────────────────────────────────

/** Next Friday 00:00 UTC — score update day */
function nextScoreUpdate(): Date {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun 1=Mon … 5=Fri 6=Sat
  // Days until next Friday (5). If today IS Friday but past midnight, roll to next week.
  const daysAway = (5 - day + 7) % 7 || 7
  const d = new Date(now)
  d.setUTCDate(now.getUTCDate() + daysAway)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** First day of next calendar month 00:00 UTC — monthly leaderboard reset */
function nextMonthReset(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
}

function formatCountdown(target: Date): string {
  const diff = target.getTime() - Date.now()
  if (diff <= 0) return 'updating now…'
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1_000)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

function SkeletonRow() {
  return <div className="h-16 bg-[#12121a] rounded-2xl animate-pulse border border-[#2a2a3a]" />
}

const PERIODS: { id: Period; label: string }[] = [
  { id: 'weekly',   label: 'This Week' },
  { id: 'monthly',  label: 'This Month' },
  { id: 'all_time', label: 'All Time' },
]

const RANK_ICONS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function LeaderboardPage() {
  const router = useRouter()
  const [period, setPeriod]   = useState<Period>('weekly')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Live countdown tickers
  const [scoreCountdown, setScoreCountdown] = useState('')
  const [resetCountdown, setResetCountdown] = useState('')

  const ptr = usePullToRefresh(async () => { await load() })

  const load = useCallback(async (p: Period = period) => {
    setLoading(prev => entries.length === 0 ? true : prev)
    try {
      const res  = await fetch(`/api/leaderboard?period=${p}`)
      const data = await res.json()
      setEntries(data.leaderboard ?? [])
    } catch { setEntries([]) }
    setLoading(false)
  }, [period, entries.length])

  useEffect(() => { load(period) }, [period])

  // Tick countdowns every second
  useEffect(() => {
    function tick() {
      setScoreCountdown(formatCountdown(nextScoreUpdate()))
      setResetCountdown(formatCountdown(nextMonthReset()))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const PERIOD_LABEL: Record<Period, string> = {
    weekly:   'Points earned this week',
    monthly:  'Points earned this month',
    all_time: 'All-time Brand Score',
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── HEADER ── */}
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <h1 className="text-xl font-black text-white mb-4">Leaderboard</h1>

        {/* Countdown cards */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {/* Score update */}
          <div
            className="rounded-2xl p-3 border border-[#C9A84C]/30"
            style={{ background: 'rgba(201,168,76,0.06)' }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm">⚡</span>
              <span className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider">Score Update</span>
            </div>
            <div className="text-white font-black text-sm tabular-nums">{scoreCountdown}</div>
            <div className="text-[#6b7280] text-[10px] mt-0.5">Every Friday</div>
          </div>

          {/* Monthly reset */}
          <div
            className="rounded-2xl p-3 border border-[#40A9FF]/20"
            style={{ background: 'rgba(64,169,255,0.05)' }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm">🏆</span>
              <span className="text-[#40A9FF] text-[10px] font-bold uppercase tracking-wider">Board Resets</span>
            </div>
            <div className="text-white font-black text-sm tabular-nums">{resetCountdown}</div>
            <div className="text-[#6b7280] text-[10px] mt-0.5">1st of each month</div>
          </div>
        </div>

        {/* Period tabs */}
        <div className="flex gap-1 bg-[#12121a] rounded-xl p-1 border border-[#2a2a3a]">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                period === p.id ? 'bg-[#C9A84C] text-black' : 'text-[#6b7280] hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── LIST ── */}
      <div
        ref={ptr.scrollRef}
        className="flex-1 overflow-y-auto px-5 pb-4"
        {...ptr.touchHandlers}
      >
        <PullIndicator pullDistance={ptr.pullDistance} refreshing={ptr.refreshing} />

        {/* Subtitle for current period */}
        <p className="text-[#4b5563] text-[10px] mb-3">{PERIOD_LABEL[period]}</p>

        {loading ? (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-3">📊</div>
            <p className="text-white font-bold mb-1">No rankings yet</p>
            <p className="text-[#6b7280] text-sm">
              {period === 'weekly'
                ? 'Make predictions this week to appear here.'
                : period === 'monthly'
                  ? 'Make predictions this month to climb the board.'
                  : 'Start making calls to build your all-time score.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map(entry => (
              <button
                key={entry.user_id}
                onClick={() => router.push(`/profile/${entry.user_id}`)}
                className="w-full bg-[#12121a] rounded-2xl border border-[#2a2a3a] p-4 flex items-center gap-4 hover:border-[#3a3a4a] transition-colors active:scale-[0.98]"
              >
                {/* Rank */}
                <div className="w-8 text-center flex-shrink-0">
                  {RANK_ICONS[entry.rank] ? (
                    <span className="text-xl">{RANK_ICONS[entry.rank]}</span>
                  ) : (
                    <span className="text-sm font-bold text-[#6b7280]">#{entry.rank}</span>
                  )}
                </div>

                {/* User info */}
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-white font-bold text-sm truncate">{entry.brand_name || entry.username}</span>
                    <LevelBadge level={entry.level} />
                  </div>
                  {entry.brand_name && (
                    <div className="text-[#6b7280] text-[10px] mb-0.5">@{entry.username}</div>
                  )}
                  <div className="text-[#6b7280] text-xs">
                    {entry.accuracy?.toFixed(1)}% accuracy
                    {entry.total_predictions ? ` · ${entry.total_predictions} calls` : ''}
                  </div>
                </div>

                {/* Period score */}
                <div className="text-right flex-shrink-0">
                  <div
                    className="font-black text-base"
                    style={{ color: entry.market_score >= 0 ? '#00C805' : '#FF3B30' }}
                  >
                    {entry.market_score >= 0 ? '+' : ''}{entry.market_score.toLocaleString()}
                  </div>
                  <div className="text-[#6b7280] text-[10px] uppercase tracking-wider">
                    {period === 'all_time' ? 'Score' : 'Pts'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
