import type { UserLevel } from './types'

export interface TierConfig {
  tier: UserLevel
  label: string
  color: string
  icon: string
  description: string
  threshold: string
}

export const TIER_CONFIG: Record<UserLevel, TierConfig> = {
  rookie: {
    tier: 'rookie',
    label: 'Rookie',
    color: '#9CA3AF',
    icon: '📈',
    description: 'Building your track record',
    threshold: '0 – 499 pts',
  },
  analyst: {
    tier: 'analyst',
    label: 'Analyst',
    color: '#40A9FF',
    icon: '📊',
    description: 'Knows the markets',
    threshold: '500 – 1,499 pts',
  },
  shark: {
    tier: 'shark',
    label: 'Shark',
    color: '#00C805',
    icon: '🦈',
    description: 'Dangerous and consistent',
    threshold: '1,500 – 3,499 pts',
  },
  leader: {
    tier: 'leader',
    label: 'Leader',
    color: '#A855F7',
    icon: '👑',
    description: 'A recognizable market voice',
    threshold: '3,500 – 6,999 pts',
  },
  guru: {
    tier: 'guru',
    label: 'Guru',
    color: '#C9A84C',
    icon: '🔮',
    description: 'The meta. Rare. Earned. Losable.',
    threshold: '7,000+ pts · 50+ calls · 60%+ accuracy',
  },
}

export const TIER_ORDER: UserLevel[] = ['rookie', 'analyst', 'shark', 'leader', 'guru']

/**
 * Calculate a user's tier from their stats.
 *
 * Guru is NOT permanent — if market_score drops below 7 000, accuracy drops
 * below 60 %, or total_predictions drops below 50, they fall back to Leader.
 * This function is the single source of truth; call it during the weekly cron
 * and store the result in profiles.level.
 */
export function getTier(
  market_score: number,
  accuracy: number,         // percentage 0–100
  total_predictions: number,
): TierConfig {
  if (
    market_score >= 7000 &&
    total_predictions >= 50 &&
    accuracy >= 60
  ) {
    return TIER_CONFIG.guru
  }

  if (market_score >= 3500) return TIER_CONFIG.leader
  if (market_score >= 1500) return TIER_CONFIG.shark
  if (market_score >= 500)  return TIER_CONFIG.analyst
  return TIER_CONFIG.rookie
}
