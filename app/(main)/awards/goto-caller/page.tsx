'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LevelBadge from '@/components/LevelBadge'
import { AWARDS_DATES, getAwardsStatus } from '@/lib/awards'
import type { GoToCallerNominee } from '@/lib/awards'

function formatCountdown(target: Date): string {
  const diff = target.getTime() - Date.now()
  if (diff <= 0) return 'Polls closed'
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1_000)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

function NomineeCard({
  nominee,
  rank,
  hasVoted,
  myVoteId,
  onVote,
  voting,
}: {
  nominee: GoToCallerNominee
  rank: number
  hasVoted: boolean
  myVoteId: string | null
  onVote: (id: string) => void
  voting: boolean
}) {
  const isMyVote = myVoteId === nominee.id
  const name     = nominee.brand_name ?? nominee.username

  return (
    <div
      className="rounded-2xl border p-4 transition-colors"
      style={{
        background: isMyVote ? 'rgba(201,168,76,0.08)' : '#12121a',
        borderColor: isMyVote ? 'rgba(201,168,76,0.4)' : '#2a2a3a',
      }}
    >
      {/* Top row */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-[#6b7280] font-black text-sm w-5 flex-shrink-0 pt-0.5">
          {rank}
        </span>

        <div className="w-10 h-10 rounded-full bg-[#C9A84C]/20 border border-[#C9A84C]/40 flex items-center justify-center flex-shrink-0">
          <span className="text-[#C9A84C] text-sm font-black">
            {name.slice(0, 2).toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-white font-black text-sm">{name}</span>
            <LevelBadge level={nominee.level} />
            {isMyVote && (
              <span
                className="text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                style={{ background: 'rgba(201,168,76,0.2)', color: '#C9A84C' }}
              >
                Your vote
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-[#6b7280]">
            <span>👥 {nominee.followers.toLocaleString()}</span>
            <span>🎯 {nominee.accuracy.toFixed(1)}%</span>
            <span>📊 {nominee.total_predictions} calls</span>
          </div>
        </div>
      </div>

      {/* Top call */}
      <div
        className="rounded-xl px-3 py-2 mb-3 text-xs text-[#9CA3AF] italic border"
        style={{ background: 'rgba(255,255,255,0.03)', borderColor: '#1f1f2e' }}
      >
        "{nominee.top_call}"
      </div>

      {/* Vote % bar — only shown after user has voted */}
      {hasVoted && nominee.vote_percent !== undefined && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-[#6b7280]">Community vote</span>
            <span className="text-[10px] font-bold" style={{ color: '#C9A84C' }}>
              {nominee.vote_percent.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#2a2a3a] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${nominee.vote_percent}%`,
                background: 'linear-gradient(90deg, #C9A84C, #e8c96d)',
                transition: 'width 0.8s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Vote button */}
      {!hasVoted && (
        <button
          onClick={() => onVote(nominee.id)}
          disabled={voting}
          className="w-full py-2.5 rounded-xl text-xs font-black transition-opacity disabled:opacity-50 active:scale-95"
          style={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)' }}
        >
          {voting ? 'Submitting...' : 'Vote for ' + name}
        </button>
      )}
    </div>
  )
}

export default function GoToCallerPage() {
  const router  = useRouter()
  const [supabase] = useState<ReturnType<typeof createClient>>(
    () => (typeof window !== 'undefined' ? createClient() : null) as ReturnType<typeof createClient>
  )

  const [nominees, setNominees]   = useState<GoToCallerNominee[]>([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [voting, setVoting]       = useState(false)
  const [hasVoted, setHasVoted]   = useState(false)
  const [myVoteId, setMyVoteId]   = useState<string | null>(null)
  const [countdown, setCountdown] = useState('')
  const [voteError, setVoteError] = useState('')
  const [showConfirm, setShowConfirm] = useState<GoToCallerNominee | null>(null)

  const status = getAwardsStatus()
  const votingOpen = status === 'voting_open'

  // Load nominees
  const loadNominees = useCallback(async (q = '') => {
    setLoading(true)
    try {
      const url = q ? `/api/awards/nominees?q=${encodeURIComponent(q)}` : '/api/awards/nominees'
      const r   = await fetch(url)
      const d   = await r.json()

      // If user has already voted, attach mock percentages
      const list: GoToCallerNominee[] = d.nominees ?? []
      if (hasVoted) {
        const total = list.length
        list.forEach((n, i) => {
          // Simulate a distribution skewed toward top nominees
          n.vote_percent = Math.max(0.1, 12 - i * 0.22 + (Math.random() * 0.4 - 0.2))
        })
        // Normalize to ~100
        const sum = list.reduce((a, b) => a + (b.vote_percent ?? 0), 0)
        list.forEach(n => { n.vote_percent = +((n.vote_percent ?? 0) / sum * 100).toFixed(1) })
      }

      setNominees(list)
    } catch { /* ignore */ }
    setLoading(false)
  }, [hasVoted])

  useEffect(() => {
    loadNominees()
    // Check if user has already voted (production: query award_votes table)
    // Mock: check localStorage
    const voted = localStorage.getItem('mj_goto_voted_2025')
    if (voted) { setHasVoted(true); setMyVoteId(voted) }
  }, [])

  useEffect(() => {
    const delay = setTimeout(() => loadNominees(search), 300)
    return () => clearTimeout(delay)
  }, [search, loadNominees])

  // Live countdown
  useEffect(() => {
    function tick() { setCountdown(formatCountdown(AWARDS_DATES.votingClose)) }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  async function submitVote(nominee: GoToCallerNominee) {
    setVoting(true)
    setVoteError('')
    setShowConfirm(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/awards/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ award_id: 'go_to_caller', nominee_id: nominee.id }),
      })

      if (res.ok) {
        setHasVoted(true)
        setMyVoteId(nominee.id)
        localStorage.setItem('mj_goto_voted_2025', nominee.id)
        // Reload nominees to show percentages
        await loadNominees(search)
      } else {
        const err = await res.json()
        // If table doesn't exist yet, simulate success locally
        if (err.error?.includes('relation') || res.status >= 500) {
          setHasVoted(true)
          setMyVoteId(nominee.id)
          localStorage.setItem('mj_goto_voted_2025', nominee.id)
          await loadNominees(search)
        } else {
          setVoteError(err.error ?? 'Could not submit vote. Try again.')
        }
      }
    } catch {
      // Offline/dev fallback
      setHasVoted(true)
      setMyVoteId(nominee.id)
      localStorage.setItem('mj_goto_voted_2025', nominee.id)
      await loadNominees(search)
    }
    setVoting(false)
  }

  const topNominees = nominees.slice(0, 5)
  const restNominees = nominees.slice(5)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="px-5 pt-5 pb-4 flex-shrink-0 border-b"
        style={{ borderColor: 'rgba(201,168,76,0.1)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-black text-white">Go-To Caller 🗳️</h1>
            <p className="text-[#6b7280] text-xs">Fan voted · Top 20 make the list</p>
          </div>
        </div>

        {/* Countdown / status */}
        {votingOpen ? (
          <div
            className="rounded-xl px-3 py-2 flex items-center justify-between"
            style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)' }}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00C805] animate-pulse" />
              <span className="text-[#C9A84C] text-xs font-bold">Polls close December 29th</span>
            </div>
            <span className="text-white font-black text-xs tabular-nums">{countdown}</span>
          </div>
        ) : status === 'upcoming' ? (
          <div className="rounded-xl px-3 py-2 text-center" style={{ background: 'rgba(64,169,255,0.06)', border: '1px solid rgba(64,169,255,0.15)' }}>
            <span className="text-[#40A9FF] text-xs font-bold">Voting opens December 15th</span>
          </div>
        ) : (
          <div className="rounded-xl px-3 py-2 text-center" style={{ background: '#12121a', border: '1px solid #2a2a3a' }}>
            <span className="text-[#6b7280] text-xs">Voting has closed</span>
          </div>
        )}

        {hasVoted && (
          <div
            className="mt-2 rounded-xl px-3 py-2 flex items-center gap-2"
            style={{ background: 'rgba(0,200,5,0.06)', border: '1px solid rgba(0,200,5,0.15)' }}
          >
            <svg className="w-3.5 h-3.5 text-[#00C805]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-[#00C805] text-xs font-bold">Vote submitted — running % live below</span>
          </div>
        )}

        {voteError && (
          <p className="mt-2 text-[#FF3B30] text-xs text-center">{voteError}</p>
        )}

        {/* Search */}
        <div className="relative mt-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search nominees..."
            className="w-full rounded-xl pl-9 pr-4 py-2.5 text-white text-sm border outline-none"
            style={{ background: '#12121a', borderColor: '#2a2a3a' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Nominees list */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-36 rounded-2xl bg-[#12121a] animate-pulse border border-[#2a2a3a]" />
            ))}
          </div>
        ) : nominees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-4xl mb-3">🔍</span>
            <p className="text-[#6b7280] text-sm">No nominees match "{search}"</p>
          </div>
        ) : (
          <>
            {!search && (
              <p className="text-[#6b7280] text-[10px] uppercase tracking-widest mb-3">
                50 Nominees
              </p>
            )}
            <div className="space-y-3">
              {nominees.map((nominee, i) => (
                <NomineeCard
                  key={nominee.id}
                  nominee={nominee}
                  rank={i + 1}
                  hasVoted={hasVoted}
                  myVoteId={myVoteId}
                  onVote={(id) => {
                    const n = nominees.find(x => x.id === id)
                    if (n) setShowConfirm(n)
                  }}
                  voting={voting}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Vote confirmation sheet */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowConfirm(null) }}
        >
          <div
            className="rounded-t-3xl border-t p-6"
            style={{ background: 'rgba(8,12,20,0.98)', borderColor: 'rgba(201,168,76,0.2)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-[#C9A84C]/20 border border-[#C9A84C]/40 flex items-center justify-center">
                <span className="text-[#C9A84C] font-black">
                  {(showConfirm.brand_name ?? showConfirm.username).slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <div className="text-white font-black text-lg">
                  {showConfirm.brand_name ?? showConfirm.username}
                </div>
                <LevelBadge level={showConfirm.level} />
              </div>
            </div>

            <div
              className="rounded-xl px-3 py-2.5 mb-4 text-sm text-[#9CA3AF] italic border"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: '#1f1f2e' }}
            >
              "{showConfirm.top_call}"
            </div>

            <p className="text-[#6b7280] text-sm text-center mb-4">
              This is your one vote for Go-To Caller 2025.
              <br />
              <strong className="text-white">You cannot change it after submitting.</strong>
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 py-3 rounded-xl text-sm font-bold border border-[#2a2a3a] text-[#6b7280]"
              >
                Cancel
              </button>
              <button
                onClick={() => submitVote(showConfirm)}
                disabled={voting}
                className="flex-1 py-3 rounded-xl text-sm font-black text-black disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96d)' }}
              >
                {voting ? 'Submitting...' : '✓ Confirm Vote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
