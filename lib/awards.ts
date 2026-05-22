import type { UserLevel } from './types'

// ── Status ─────────────────────────────────────────────────────────────────

export type AwardStatus = 'upcoming' | 'voting_open' | 'voting_closed' | 'announced'

/** Key dates for the annual awards season */
export const AWARDS_DATES = {
  teaser:            new Date('2025-12-14T00:00:00Z'), // teaser notification
  votingOpen:        new Date('2025-12-15T00:00:00Z'), // finalists live, voting opens
  votingClose:       new Date('2025-12-29T23:59:59Z'), // hard stop
  winnersAnnounced:  new Date('2026-01-02T00:00:00Z'), // first Friday of January
}

export function getAwardsStatus(): AwardStatus {
  const now = new Date()
  if (now < AWARDS_DATES.votingOpen)    return 'upcoming'
  if (now <= AWARDS_DATES.votingClose)  return 'voting_open'
  if (now < AWARDS_DATES.winnersAnnounced) return 'voting_closed'
  return 'announced'
}

// ── Award definitions ───────────────────────────────────────────────────────

export type AwardId =
  | 'go_to_caller'
  | 'most_accurate'
  | 'best_bull_call'
  | 'best_bear_call'
  | 'most_improved'
  | 'breakout_shark'
  | 'macro_oracle'

export interface AwardDef {
  id: AwardId
  name: string
  icon: string
  description: string
  criteria: string
  isFanVote: boolean     // true = Go-To Caller pure fan vote
  minPredictions: number // minimum activity to qualify
}

export const AWARDS: AwardDef[] = [
  {
    id: 'go_to_caller',
    name: 'Go-To Caller',
    icon: '🗳️',
    description: 'The voice the community trusts most.',
    criteria:
      'Algorithm nominates 50 from followers + activity + credibility. Fan vote selects final 20.',
    isFanVote: true,
    minPredictions: 20,
  },
  {
    id: 'most_accurate',
    name: 'Most Accurate Caller',
    icon: '🎯',
    description: 'Highest accuracy among high-volume callers.',
    criteria: 'Minimum 50 predictions. Top 50 by accuracy score. 80% algo + 20% community vote.',
    isFanVote: false,
    minPredictions: 50,
  },
  {
    id: 'best_bull_call',
    name: 'Best Bull Call',
    icon: '🐂',
    description: 'The single bullish prediction that paid off most.',
    criteria: 'Measured by % gain captured. Top 50 finalists. 80/20 vote.',
    isFanVote: false,
    minPredictions: 10,
  },
  {
    id: 'best_bear_call',
    name: 'Best Bear Call',
    icon: '🐻',
    description: 'Called the drop before anyone else.',
    criteria: 'Measured by % drop captured. Top 50 finalists. 80/20 vote.',
    isFanVote: false,
    minPredictions: 10,
  },
  {
    id: 'most_improved',
    name: 'Most Improved',
    icon: '📈',
    description: 'Biggest accuracy and score jump year-over-year.',
    criteria: 'Minimum 20 predictions. Ranked by YoY improvement. 80/20 vote.',
    isFanVote: false,
    minPredictions: 20,
  },
  {
    id: 'breakout_shark',
    name: 'Breakout Shark',
    icon: '🦈',
    description: 'Best new caller of the year.',
    criteria: 'Account created this year. Top 50 by score. 80/20 vote.',
    isFanVote: false,
    minPredictions: 15,
  },
  {
    id: 'macro_oracle',
    name: 'Macro Oracle',
    icon: '🔮',
    description: 'Best macro-level market call of the year.',
    criteria: 'Macro category predictions only. Top 50 by impact score. 80/20 vote.',
    isFanVote: false,
    minPredictions: 10,
  },
]

// ── Go-To Caller types ──────────────────────────────────────────────────────

export type GoToCallerTeamTier = 'first' | 'second' | 'caller'

export interface GoToCallerNominee {
  id: string
  username: string
  brand_name: string | null
  brand_avatar_url: string | null
  level: UserLevel | string
  followers: number
  accuracy: number
  total_predictions: number
  top_call: string          // "Called NVDA +47% surge in March before earnings"
  vote_percent?: number     // revealed after user has voted
}

export interface GoToCallerResult {
  year: number
  first_team: GoToCallerNominee[]   // ranks 1–5,  gold pendant
  second_team: GoToCallerNominee[]  // ranks 6–10, silver pendant
  callers: GoToCallerNominee[]      // ranks 11–20, bronze pendant
}

export const TEAM_CONFIG: Record<GoToCallerTeamTier, {
  label: string
  badge: string
  pendant: string
  color: string
  bgColor: string
}> = {
  first: {
    label: 'First Team',
    badge: '🥇 First Team Go-To Caller',
    pendant: '🥇',
    color: '#C9A84C',
    bgColor: 'rgba(201,168,76,0.1)',
  },
  second: {
    label: 'Second Team',
    badge: '🥈 Second Team Go-To Caller',
    pendant: '🥈',
    color: '#9CA3AF',
    bgColor: 'rgba(156,163,175,0.08)',
  },
  caller: {
    label: 'Go-To Callers',
    badge: '🥉 Go-To Caller',
    pendant: '🥉',
    color: '#CD7F32',
    bgColor: 'rgba(205,127,50,0.08)',
  },
}

// ── General finalist / winner types ────────────────────────────────────────

export interface AwardFinalist {
  id: string
  username: string
  brand_name: string | null
  level: UserLevel | string
  algo_score: number     // 0–100 normalized
  vote_percent: number   // community vote % of this finalist
  combined_score: number // 0.8 * algo_score + 0.2 * vote_score
  stat_label: string     // "94.2% accuracy" / "TSLA –38% called"
  is_winner?: boolean
}

// ── Notification copy ───────────────────────────────────────────────────────

export const AWARD_NOTIFICATIONS = {
  teaser:   '🏆 Award finalists are announced tomorrow. Stay tuned.',
  open:     '🏆 Award finalists are live. Voting is open.',
  closing:  '🗳️ Last day to vote. Polls close tonight.',
  winners:  '🏆 MarketJump Award winners are live. See who took home the trophy.',
} as const
