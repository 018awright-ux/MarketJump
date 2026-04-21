import type { UserLevel } from '@/lib/types'

const LEVEL_CONFIG: Record<UserLevel, { label: string; color: string; icon: string }> = {
  rookie: { label: 'Rookie', color: '#6b7280', icon: '📈' },
  analyst: { label: 'Analyst', color: '#40A9FF', icon: '📊' },
  shark: { label: 'Shark', color: '#00C805', icon: '🦈' },
}

export default function LevelBadge({ level }: { level: UserLevel }) {
  const config = LEVEL_CONFIG[level]
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ color: config.color, backgroundColor: `color-mix(in srgb, ${config.color} 15%, transparent)` }}
    >
      <span>{config.icon}</span>
      {config.label}
    </span>
  )
}
