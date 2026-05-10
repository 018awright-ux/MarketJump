import type { UserLevel } from '@/lib/types'
import { TIER_CONFIG } from '@/lib/tier'

export default function LevelBadge({ level }: { level: UserLevel | string }) {
  const config = TIER_CONFIG[level as UserLevel] ?? TIER_CONFIG.rookie
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
      style={{
        color: config.color,
        backgroundColor: `color-mix(in srgb, ${config.color} 15%, transparent)`,
      }}
    >
      <span>{config.icon}</span>
      {config.label}
    </span>
  )
}
