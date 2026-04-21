'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LevelBadge from '@/components/LevelBadge'
import type { UserLevel } from '@/lib/types'

type Period = 'daily' | 'weekly' | 'all'

interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  level: UserLevel
  accuracy: number
  market_score: number
  total_predictions?: number
}

export default function LeaderboardPage() {
  const router = useRouter()
  const [period, setPeriod] = useState<Period>('all')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLeaderboard()
  }, [period])

  async function loadLeaderboard() {
    setLoading(true)
    try {
      const res = await fetch(`/api/leaderboard?period=${period}`)
      const data = await res.json()
      setEntries(data.leaderboard ?? [])
    } catch { setEntries([]) }
    setLoading(false)
  }

  const PERIODS: { id: Period; label: string }[] = [
    { id: 'daily', label: 'Today' },
    { id: 'weekly', label: 'This Week' },
    { id: 'all', label: 'All Time' },
  ]

  const RANK_ICONS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h1 className="text-xl font-black text-white mb-4">Leaderboard</h1>

        {/* Period tabs */}
        <div className="flex gap-2 bg-[#12121a] rounded-xl p-1 border border-[#2a2a3a]">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                period === p.id
                  ? 'bg-[#00C805] text-black'
                  : 'text-[#6b7280] hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 bg-[#12121a] rounded-2xl animate-pulse" />
            ))}
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
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-white font-bold text-sm">{entry.username}</span>
                    <LevelBadge level={entry.level} />
                  </div>
                  <div className="text-[#6b7280] text-xs">
                    {entry.accuracy?.toFixed(1)}% accuracy
                    {entry.total_predictions ? ` · ${entry.total_predictions} calls` : ''}
                  </div>
                </div>

                {/* Score */}
                <div className="text-right flex-shrink-0">
                  <div className="text-[#00C805] font-black text-base">{entry.market_score.toLocaleString()}</div>
                  <div className="text-[#6b7280] text-[10px] uppercase tracking-wider">Score</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
