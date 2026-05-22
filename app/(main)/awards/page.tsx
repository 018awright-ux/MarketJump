'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LevelBadge from '@/components/LevelBadge'
import {
  AWARDS,
  AWARDS_DATES,
  getAwardsStatus,
  TEAM_CONFIG,
  type GoToCallerResult,
  type AwardStatus,
} from '@/lib/awards'

function formatCountdown(target: Date): string {
  const diff = target.getTime() - Date.now()
  if (diff <= 0) return 'now'
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function StatusBanner({ status }: { status: AwardStatus }) {
  if (status === 'voting_open') {
    return (
      <div
        className="rounded-2xl p-4 border mb-4"
        style={{ background: 'rgba(201,168,76,0.08)', borderColor: 'rgba(201,168,76,0.3)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#00C805] animate-pulse inline-block" />
              <span className="text-[#C9A84C] text-xs font-black uppercase tracking-widest">Voting Live</span>
            </div>
            <p className="text-white font-bold text-sm">Cast your votes before December 29th</p>
          </div>
          <div className="text-right">
            <div className="text-[#C9A84C] font-black text-sm tabular-nums">
              Closes in {formatCountdown(AWARDS_DATES.votingClose)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'upcoming') {
    return (
      <div
        className="rounded-2xl p-4 border mb-4"
        style={{ background: 'rgba(64,169,255,0.05)', borderColor: 'rgba(64,169,255,0.2)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[#40A9FF] text-xs font-black uppercase tracking-widest">Coming Soon</span>
        </div>
        <p className="text-white font-bold text-sm">
          Voting opens December 15th. Finalists announced then.
        </p>
        <p className="text-[#6b7280] text-xs mt-1">
          Opens in {formatCountdown(AWARDS_DATES.votingOpen)}
        </p>
      </div>
    )
  }

  if (status === 'voting_closed') {
    return (
      <div
        className="rounded-2xl p-4 border mb-4"
        style={{ background: 'rgba(168,85,247,0.06)', borderColor: 'rgba(168,85,247,0.2)' }}
      >
        <p className="text-[#A855F7] text-xs font-black uppercase tracking-widest mb-1">Votes Counted</p>
        <p className="text-white font-bold text-sm">Winners announced first Friday of January 🏆</p>
      </div>
    )
  }

  return null // 'announced' — let the results speak
}

function GoToCallerResultsSection({ results }: { results: GoToCallerResult[] }) {
  const [expandedYears, setExpandedYears] = useState<number[]>([])

  if (results.length === 0) return null

  const latest = results[0]
  const historical = results.slice(1)

  return (
    <div className="mb-6">
      {/* Current year — full display */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-white font-black text-sm">{latest.year} Results</span>
      </div>

      {/* First Team — displayed largest */}
      <div
        className="rounded-2xl border p-4 mb-3"
        style={{ background: 'rgba(201,168,76,0.06)', borderColor: 'rgba(201,168,76,0.25)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🥇</span>
          <span className="text-[#C9A84C] font-black text-sm uppercase tracking-wider">First Team</span>
        </div>
        <div className="space-y-2">
          {latest.first_team.map((caller, i) => (
            <div key={caller.id} className="flex items-center gap-3">
              <span className="text-[#C9A84C] font-black text-sm w-4">{i + 1}</span>
              <div className="w-8 h-8 rounded-full bg-[#C9A84C]/20 border border-[#C9A84C]/40 flex items-center justify-center flex-shrink-0">
                <span className="text-[#C9A84C] text-xs font-black">
                  {(caller.brand_name ?? caller.username).slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-sm truncate">
                  {caller.brand_name ?? caller.username}
                </div>
                <div className="text-[#6b7280] text-[10px] truncate">{caller.top_call}</div>
              </div>
              <LevelBadge level={caller.level} />
            </div>
          ))}
        </div>
      </div>

      {/* Second Team */}
      <div
        className="rounded-2xl border p-4 mb-3"
        style={{ background: 'rgba(156,163,175,0.04)', borderColor: 'rgba(156,163,175,0.15)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🥈</span>
          <span className="text-[#9CA3AF] font-black text-sm uppercase tracking-wider">Second Team</span>
        </div>
        <div className="space-y-2">
          {latest.second_team.map((caller, i) => (
            <div key={caller.id} className="flex items-center gap-3">
              <span className="text-[#9CA3AF] font-bold text-xs w-4">{i + 6}</span>
              <div className="flex-1 min-w-0">
                <span className="text-white font-bold text-sm">{caller.brand_name ?? caller.username}</span>
                <LevelBadge level={caller.level} />
              </div>
              <span className="text-[#6b7280] text-xs">{caller.accuracy.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Go-To Callers */}
      <div
        className="rounded-2xl border p-4"
        style={{ background: 'rgba(205,127,50,0.04)', borderColor: 'rgba(205,127,50,0.15)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🥉</span>
          <span className="font-black text-sm uppercase tracking-wider" style={{ color: '#CD7F32' }}>
            Go-To Callers
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {latest.callers.map((caller, i) => (
            <div
              key={caller.id}
              className="rounded-xl border px-2 py-1.5"
              style={{ background: 'rgba(205,127,50,0.06)', borderColor: 'rgba(205,127,50,0.12)' }}
            >
              <div className="text-white font-bold text-xs truncate">{caller.brand_name ?? caller.username}</div>
              <div className="text-[#6b7280] text-[10px]">#{i + 11} · {caller.accuracy.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Historical years — expandable */}
      {historical.length > 0 && (
        <div className="mt-4">
          <p className="text-[#6b7280] text-[10px] uppercase tracking-widest mb-2">Previous Years</p>
          {historical.map(hist => (
            <div key={hist.year} className="mb-2">
              <button
                onClick={() =>
                  setExpandedYears(prev =>
                    prev.includes(hist.year) ? prev.filter(y => y !== hist.year) : [...prev, hist.year]
                  )
                }
                className="w-full flex items-center justify-between rounded-xl border p-3 text-left"
                style={{ background: '#12121a', borderColor: '#2a2a3a' }}
              >
                <span className="text-white font-bold text-sm">{hist.year} Winners</span>
                <svg
                  className={`w-4 h-4 text-[#6b7280] transition-transform ${
                    expandedYears.includes(hist.year) ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedYears.includes(hist.year) && (
                <div className="rounded-xl border border-t-0 p-3 space-y-2" style={{ background: '#12121a', borderColor: '#2a2a3a', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                  <p className="text-[#6b7280] text-xs font-bold">First Team</p>
                  {hist.first_team.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-2 text-sm">
                      <span className="text-[#C9A84C] font-bold w-4">{i + 1}</span>
                      <span className="text-white font-medium">{c.brand_name ?? c.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AwardsPage() {
  const router = useRouter()
  const [status, setStatus] = useState<AwardStatus>('upcoming')
  const [gotoResults, setGotoResults] = useState<GoToCallerResult[]>([])
  const [countdown, setCountdown] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setStatus(getAwardsStatus())

    fetch('/api/awards?type=goto-caller-results')
      .then(r => r.json())
      .then(d => setGotoResults(d.results ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function tick() {
      const st = getAwardsStatus()
      if (st === 'upcoming') setCountdown(formatCountdown(AWARDS_DATES.votingOpen))
      else if (st === 'voting_open') setCountdown(formatCountdown(AWARDS_DATES.votingClose))
      else setCountdown('')
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-white">MarketJump Awards</h1>
          <span className="text-[#C9A84C] text-xs font-bold">2025 Season</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {/* Status banner */}
        <StatusBanner status={status} />

        {/* ── Go-To Caller — Fan Voted (prominent) ── */}
        <div
          className="rounded-2xl border p-4 mb-4"
          style={{ background: 'rgba(201,168,76,0.04)', borderColor: 'rgba(201,168,76,0.2)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🗳️</span>
              <div>
                <div className="text-white font-black text-base">Go-To Callers</div>
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
            Not about accuracy. About trust.
          </p>

          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-8 rounded-xl bg-[#12121a] animate-pulse" />
              ))}
            </div>
          ) : gotoResults.length > 0 ? (
            <GoToCallerResultsSection results={gotoResults} />
          ) : (
            <div className="rounded-xl border border-[#2a2a3a] p-4 text-center">
              <p className="text-[#6b7280] text-sm">
                {status === 'upcoming'
                  ? 'Nominees announced December 15th.'
                  : 'Results pending.'}
              </p>
            </div>
          )}
        </div>

        {/* ── Other Awards ── */}
        <p className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-widest mb-3">
          Community + Algorithm Awards
        </p>
        <div className="space-y-2 mb-6">
          {AWARDS.filter(a => !a.isFanVote).map(award => (
            <button
              key={award.id}
              onClick={() => status === 'voting_open' && router.push(`/awards/vote/${award.id}`)}
              className="w-full rounded-2xl border p-4 text-left transition-colors active:opacity-80"
              style={{ background: '#12121a', borderColor: '#2a2a3a' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{award.icon}</span>
                  <div>
                    <div className="text-white font-bold text-sm">{award.name}</div>
                    <div className="text-[#6b7280] text-xs">{award.description}</div>
                  </div>
                </div>
                {status === 'voting_open' ? (
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(0,200,5,0.12)', color: '#00C805' }}
                  >
                    Vote
                  </span>
                ) : (
                  <svg className="w-4 h-4 text-[#6b7280] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
              <div
                className="mt-2 text-[10px] text-[#4b5563] leading-relaxed"
              >
                {award.criteria}
              </div>
            </button>
          ))}
        </div>

        {/* How voting works */}
        <div
          className="rounded-2xl border p-4"
          style={{ background: '#12121a', borderColor: '#2a2a3a' }}
        >
          <p className="text-[#6b7280] text-[10px] font-bold uppercase tracking-widest mb-3">How It Works</p>
          <div className="space-y-2 text-xs text-[#6b7280]">
            <div className="flex gap-2">
              <span className="text-[#C9A84C] font-bold flex-shrink-0">1.</span>
              <span>Algorithm ranks top 50 finalists per award by activity + performance score</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#C9A84C] font-bold flex-shrink-0">2.</span>
              <span>Community votes December 15–29. One vote per award per user.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#C9A84C] font-bold flex-shrink-0">3.</span>
              <span>Final score: 80% algorithm + 20% community vote. Except Go-To Caller — pure fan vote.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#C9A84C] font-bold flex-shrink-0">4.</span>
              <span>Winners announced first Friday of January on Market Judgment Day.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
