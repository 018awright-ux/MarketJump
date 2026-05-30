'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import LevelBadge from '@/components/LevelBadge'
import PullIndicator from '@/components/PullIndicator'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import type { UserLevel } from '@/lib/types'
import {
  AWARDS,
  AWARDS_DATES,
  getAwardsStatus,
  type GoToCallerResult,
  type AwardStatus,
} from '@/lib/awards'

type Period = 'weekly' | 'monthly' | 'all_time'
type Tab = Period | 'awards'

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

function nextScoreUpdate(): Date {
  const now = new Date()
  const day = now.getUTCDay()
  const daysAway = (5 - day + 7) % 7 || 7
  const d = new Date(now)
  d.setUTCDate(now.getUTCDate() + daysAway)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

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

function formatAwardsCountdown(target: Date): string {
  const diff = target.getTime() - Date.now()
  if (diff <= 0) return 'now'
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function SkeletonRow() {
  return <div className="h-16 bg-[#12121a] rounded-2xl animate-pulse border border-[#2a2a3a]" />
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'weekly',   label: 'This Week' },
  { id: 'monthly',  label: 'This Month' },
  { id: 'all_time', label: 'All Time' },
  { id: 'awards',   label: '🏆 Awards' },
]

const RANK_ICONS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

// ── Weekly Contrarian Champion mock data ──────────────────────────────────────

const WEEKLY_CONTRARIAN = {
  winner: { name: 'MacroMaven', level: 'leader' as UserLevel, call: 'Shorted TSLA into earnings against the crowd — paid off +23%', accuracy: 73.1 },
  board: [
    { rank: 1, name: 'MacroMaven',    pts: +340, level: 'leader'  as UserLevel },
    { rank: 2, name: 'BearBrigade',   pts: +290, level: 'shark'   as UserLevel },
    { rank: 3, name: 'TheContrarian', pts: +210, level: 'leader'  as UserLevel },
    { rank: 4, name: 'VolHunter',     pts: +185, level: 'shark'   as UserLevel },
    { rank: 5, name: 'DarkPoolDan',   pts: +160, level: 'leader'  as UserLevel },
  ],
}

// ── Awards tab sub-components ─────────────────────────────────────────────────

function AwardsStatusBanner({ status }: { status: AwardStatus }) {
  if (status === 'voting_open') {
    return (
      <div className="rounded-2xl p-3 border mb-4" style={{ background: 'rgba(201,168,76,0.08)', borderColor: 'rgba(201,168,76,0.3)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-[#00C805] animate-pulse inline-block" />
              <span className="text-[#C9A84C] text-[10px] font-black uppercase tracking-widest">Voting Live</span>
            </div>
            <p className="text-white font-bold text-sm">Cast votes before December 29th</p>
          </div>
          <div className="text-[#C9A84C] font-black text-xs tabular-nums">
            Closes in {formatAwardsCountdown(AWARDS_DATES.votingClose)}
          </div>
        </div>
      </div>
    )
  }
  if (status === 'upcoming') {
    return (
      <div className="rounded-2xl p-3 border mb-4" style={{ background: 'rgba(64,169,255,0.05)', borderColor: 'rgba(64,169,255,0.2)' }}>
        <p className="text-[#40A9FF] text-[10px] font-black uppercase tracking-widest mb-0.5">Coming Soon</p>
        <p className="text-white font-bold text-sm">Voting opens Dec 15th · Opens in {formatAwardsCountdown(AWARDS_DATES.votingOpen)}</p>
      </div>
    )
  }
  if (status === 'voting_closed') {
    return (
      <div className="rounded-2xl p-3 border mb-4" style={{ background: 'rgba(168,85,247,0.06)', borderColor: 'rgba(168,85,247,0.2)' }}>
        <p className="text-[#A855F7] text-[10px] font-black uppercase tracking-widest mb-0.5">Votes Counted</p>
        <p className="text-white font-bold text-sm">Winners announced first Friday of January 🏆</p>
      </div>
    )
  }
  return null
}

function GoToCallerSection({
  results,
  status,
  router,
}: {
  results: GoToCallerResult[]
  status: AwardStatus
  router: ReturnType<typeof useRouter>
}) {
  const [expandedYears, setExpandedYears] = useState<number[]>([])

  return (
    <div className="mb-5">
      <div
        className="rounded-2xl border p-4 mb-3"
        style={{ background: 'rgba(201,168,76,0.04)', borderColor: 'rgba(201,168,76,0.2)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🗳️</span>
            <div>
              <div className="text-white font-black text-sm">Go-To Callers</div>
              <div className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider">Fan Voted</div>
            </div>
          </div>
          {(status === 'voting_open' || status === 'upcoming') && (
            <button
              onClick={() => router.push('/awards/goto-caller')}
              className="px-3 py-1.5 rounded-xl text-xs font-black text-black"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96d)' }}
            >
              {status === 'voting_open' ? 'Vote Now' : 'See Nominees'}
            </button>
          )}
        </div>
        <p className="text-[#6b7280] text-xs mb-3">
          The voice the community trusts most. Algorithm nominates 50 — you decide the final 20.
        </p>

        {results.length > 0 ? (
          <>
            {/* First Team */}
            <div className="rounded-xl border p-3 mb-2" style={{ background: 'rgba(201,168,76,0.06)', borderColor: 'rgba(201,168,76,0.2)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <span>🥇</span>
                <span className="text-[#C9A84C] font-black text-xs uppercase tracking-wider">First Team</span>
              </div>
              <div className="space-y-2">
                {results[0].first_team.map((caller, i) => (
                  <div key={caller.id} className="flex items-center gap-2">
                    <span className="text-[#C9A84C] font-black text-xs w-3">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold text-xs truncate">{caller.brand_name ?? caller.username}</div>
                      <div className="text-[#6b7280] text-[10px] truncate">{caller.top_call}</div>
                    </div>
                    <LevelBadge level={caller.level} />
                  </div>
                ))}
              </div>
            </div>
            {/* Second Team compact */}
            <div className="rounded-xl border p-3 mb-2" style={{ background: 'rgba(156,163,175,0.04)', borderColor: 'rgba(156,163,175,0.15)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <span>🥈</span>
                <span className="text-[#9CA3AF] font-black text-xs uppercase tracking-wider">Second Team</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {results[0].second_team.map((caller, i) => (
                  <div key={caller.id} className="text-xs">
                    <span className="text-[#9CA3AF] font-bold">#{i + 6}</span>
                    <span className="text-white ml-1 truncate">{caller.brand_name ?? caller.username}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Go-To Callers grid */}
            <div className="rounded-xl border p-3" style={{ background: 'rgba(205,127,50,0.04)', borderColor: 'rgba(205,127,50,0.12)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <span>🥉</span>
                <span className="font-black text-xs uppercase tracking-wider" style={{ color: '#CD7F32' }}>Go-To Callers</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {results[0].callers.map((caller, i) => (
                  <div key={caller.id} className="text-[10px] text-[#6b7280]">
                    #{i + 11} {caller.brand_name ?? caller.username}
                  </div>
                ))}
              </div>
            </div>

            {/* Award history — expandable */}
            {results.slice(1).length > 0 && (
              <div className="mt-3">
                <p className="text-[#6b7280] text-[10px] uppercase tracking-widest mb-1.5">Previous Years</p>
                {results.slice(1).map(hist => (
                  <div key={hist.year} className="mb-1.5">
                    <button
                      onClick={() => setExpandedYears(prev =>
                        prev.includes(hist.year) ? prev.filter(y => y !== hist.year) : [...prev, hist.year]
                      )}
                      className="w-full flex items-center justify-between rounded-xl border p-3 text-left"
                      style={{ background: '#12121a', borderColor: '#2a2a3a' }}
                    >
                      <span className="text-white font-bold text-sm">{hist.year} Winners</span>
                      <svg className={`w-4 h-4 text-[#6b7280] transition-transform ${expandedYears.includes(hist.year) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedYears.includes(hist.year) && (
                      <div className="rounded-b-xl border border-t-0 p-3 space-y-1" style={{ background: '#12121a', borderColor: '#2a2a3a' }}>
                        <p className="text-[#6b7280] text-[10px] font-bold mb-1">First Team</p>
                        {hist.first_team.map((c, i) => (
                          <div key={c.id} className="flex items-center gap-2 text-xs">
                            <span className="text-[#C9A84C] font-bold w-3">{i + 1}</span>
                            <span className="text-white">{c.brand_name ?? c.username}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-[#2a2a3a] p-3 text-center">
            <p className="text-[#6b7280] text-sm">
              {status === 'upcoming' ? 'Nominees announced December 15th.' : 'Results pending.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function AwardsTab({ router }: { router: ReturnType<typeof useRouter> }) {
  const [status, setStatus] = useState<AwardStatus>('upcoming')
  const [gotoResults, setGotoResults] = useState<GoToCallerResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setStatus(getAwardsStatus())
    fetch('/api/awards?type=goto-caller-results')
      .then(r => r.json())
      .then(d => setGotoResults(d.results ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-0">
      {/* Status banner */}
      <AwardsStatusBanner status={status} />

      {/* ── Weekly Contrarian Champion ── */}
      <div className="mb-5">
        <p className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-widest mb-3">
          Weekly Contrarian Champion
        </p>
        <div className="rounded-2xl border p-4 mb-3" style={{ background: 'rgba(0,200,5,0.04)', borderColor: 'rgba(0,200,5,0.15)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#00C805]/20 border border-[#00C805]/30 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">🏆</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-black text-sm">{WEEKLY_CONTRARIAN.winner.name}</span>
                <LevelBadge level={WEEKLY_CONTRARIAN.winner.level} />
              </div>
              <div className="text-[#00C805] text-[10px] font-bold uppercase tracking-wider">This Week&apos;s Winner</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[#00C805] font-black text-sm">{WEEKLY_CONTRARIAN.winner.accuracy}%</div>
              <div className="text-[#6b7280] text-[10px]">accuracy</div>
            </div>
          </div>
          <div className="rounded-xl border border-[#2a2a3a] px-3 py-2 text-[#6b7280] text-xs italic">
            &ldquo;{WEEKLY_CONTRARIAN.winner.call}&rdquo;
          </div>
        </div>

        {/* Medal board */}
        <div className="space-y-1.5">
          {WEEKLY_CONTRARIAN.board.map(entry => (
            <div key={entry.rank} className="flex items-center gap-3 rounded-xl border border-[#2a2a3a] p-3" style={{ background: '#12121a' }}>
              <div className="w-7 text-center flex-shrink-0">
                {RANK_ICONS[entry.rank] ? (
                  <span className="text-base">{RANK_ICONS[entry.rank]}</span>
                ) : (
                  <span className="text-xs font-bold text-[#6b7280]">#{entry.rank}</span>
                )}
              </div>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-white font-bold text-sm truncate">{entry.name}</span>
                <LevelBadge level={entry.level} />
              </div>
              <div className="font-black text-sm text-[#00C805] flex-shrink-0">
                +{entry.pts}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Go-To Caller + Award History ── */}
      {loading ? (
        <div className="space-y-2 mb-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded-xl bg-[#12121a] animate-pulse" />)}
        </div>
      ) : (
        <GoToCallerSection results={gotoResults} status={status} router={router} />
      )}

      {/* ── Annual Awards (frontrunners) ── */}
      <div className="mb-5">
        <p className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-widest mb-3">
          2025 Annual Awards
        </p>
        <div className="space-y-2">
          {AWARDS.filter(a => !a.isFanVote).map(award => (
            <button
              key={award.id}
              onClick={() => status === 'voting_open' && router.push(`/awards/vote/${award.id}`)}
              className="w-full rounded-2xl border p-4 text-left transition-colors active:opacity-80"
              style={{ background: '#12121a', borderColor: '#2a2a3a' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{award.icon}</span>
                  <div>
                    <div className="text-white font-bold text-sm">{award.name}</div>
                    <div className="text-[#6b7280] text-xs">{award.description}</div>
                  </div>
                </div>
                {status === 'voting_open' ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(0,200,5,0.12)', color: '#00C805' }}>
                    Vote
                  </span>
                ) : (
                  <svg className="w-4 h-4 text-[#6b7280] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
              <p className="mt-1.5 text-[10px] text-[#4b5563]">{award.criteria}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Hall of Fame ── */}
      <div
        className="rounded-2xl border p-4 text-center mb-6"
        style={{ background: 'rgba(201,168,76,0.03)', borderColor: 'rgba(201,168,76,0.12)' }}
      >
        <div className="text-3xl mb-2">🏛️</div>
        <p className="text-white font-black text-sm mb-1">Hall of Fame</p>
        <p className="text-[#6b7280] text-xs">Legends who shaped the board. Coming 2026.</p>
        <span className="inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-bold text-[#C9A84C] border border-[#C9A84C]/30" style={{ background: 'rgba(201,168,76,0.06)' }}>
          Coming Soon
        </span>
      </div>

      {/* How it works */}
      <div className="rounded-2xl border p-4 mb-6" style={{ background: '#12121a', borderColor: '#2a2a3a' }}>
        <p className="text-[#6b7280] text-[10px] font-bold uppercase tracking-widest mb-3">How Voting Works</p>
        <div className="space-y-2 text-xs text-[#6b7280]">
          {[
            'Algorithm ranks top 50 finalists per award by activity + performance score',
            'Community votes December 15–29. One vote per award per user.',
            'Final score: 80% algorithm + 20% community vote. Except Go-To Caller — pure fan vote.',
            'Winners announced first Friday of January on Market Judgment Day.',
          ].map((step, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-[#C9A84C] font-bold flex-shrink-0">{i + 1}.</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('weekly')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const [scoreCountdown, setScoreCountdown] = useState('')
  const [resetCountdown, setResetCountdown] = useState('')

  const ptr = usePullToRefresh(async () => { await load() })

  const isPeriodTab = (t: Tab): t is Period => t !== 'awards'

  const load = useCallback(async (tab: Tab = activeTab) => {
    if (!isPeriodTab(tab)) return
    setLoading(prev => entries.length === 0 ? true : prev)
    try {
      const res  = await fetch(`/api/leaderboard?period=${tab}`)
      const data = await res.json()
      setEntries(data.leaderboard ?? [])
    } catch { setEntries([]) }
    setLoading(false)
  }, [activeTab, entries.length])

  useEffect(() => {
    if (isPeriodTab(activeTab)) {
      load(activeTab)
    } else {
      setLoading(false)
    }
  }, [activeTab])

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
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-xl font-black text-white">Leaders</h1>
          <span className="text-lg">🏆</span>
        </div>

        {/* Countdown cards — only shown on leaderboard tabs */}
        {isPeriodTab(activeTab) && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="rounded-2xl p-3 border border-[#C9A84C]/30" style={{ background: 'rgba(201,168,76,0.06)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">⚡</span>
                <span className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-wider">Score Update</span>
              </div>
              <div className="text-white font-black text-sm tabular-nums">{scoreCountdown}</div>
              <div className="text-[#6b7280] text-[10px] mt-0.5">Every Friday</div>
            </div>
            <div className="rounded-2xl p-3 border border-[#40A9FF]/20" style={{ background: 'rgba(64,169,255,0.05)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">📅</span>
                <span className="text-[#40A9FF] text-[10px] font-bold uppercase tracking-wider">Board Resets</span>
              </div>
              <div className="text-white font-black text-sm tabular-nums">{resetCountdown}</div>
              <div className="text-[#6b7280] text-[10px] mt-0.5">1st of each month</div>
            </div>
          </div>
        )}

        {/* Tabs — scrollable strip */}
        <div className="flex gap-1 bg-[#12121a] rounded-xl p-1 border border-[#2a2a3a] overflow-x-auto scrollbar-hide">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-shrink-0 py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === t.id ? 'bg-[#C9A84C] text-black' : 'text-[#6b7280] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div
        ref={ptr.scrollRef}
        className="flex-1 overflow-y-auto px-5 pb-4"
        {...ptr.touchHandlers}
      >
        <PullIndicator pullDistance={ptr.pullDistance} refreshing={ptr.refreshing} />

        {activeTab === 'awards' ? (
          <AwardsTab router={router} />
        ) : (
          <>
            <p className="text-[#4b5563] text-[10px] mb-3">{PERIOD_LABEL[activeTab]}</p>

            {loading ? (
              <div className="space-y-3">
                {[...Array(8)].map((_, i) => <SkeletonRow key={i} />)}
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-5xl mb-3">📊</div>
                <p className="text-white font-bold mb-1">No rankings yet</p>
                <p className="text-[#6b7280] text-sm">
                  {activeTab === 'weekly'
                    ? 'Make predictions this week to appear here.'
                    : activeTab === 'monthly'
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
                    <div className="w-8 text-center flex-shrink-0">
                      {RANK_ICONS[entry.rank] ? (
                        <span className="text-xl">{RANK_ICONS[entry.rank]}</span>
                      ) : (
                        <span className="text-sm font-bold text-[#6b7280]">#{entry.rank}</span>
                      )}
                    </div>
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
                    <div className="text-right flex-shrink-0">
                      <div
                        className="font-black text-base"
                        style={{ color: entry.market_score >= 0 ? '#00C805' : '#FF3B30' }}
                      >
                        {entry.market_score >= 0 ? '+' : ''}{entry.market_score.toLocaleString()}
                      </div>
                      <div className="text-[#6b7280] text-[10px] uppercase tracking-wider">
                        {activeTab === 'all_time' ? 'Score' : 'Pts'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
