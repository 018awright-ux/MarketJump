import type { SourceBadge as SourceBadgeType } from '@/lib/types'

const BADGE_CONFIG: Record<SourceBadgeType, { label: string; color: string; bg: string }> = {
  reddit: { label: 'Reddit', color: '#FF4500', bg: '#FF4500/15' },
  stocktwits: { label: 'StockTwits', color: '#40A9FF', bg: '#40A9FF/15' },
  news: { label: 'News', color: '#F59E0B', bg: '#F59E0B/15' },
  user: { label: 'User', color: '#00C805', bg: '#00C805/15' },
}

interface SourceBadgeProps {
  source: SourceBadgeType
  sourceName?: string
}

export default function SourceBadge({ source, sourceName }: SourceBadgeProps) {
  const config = BADGE_CONFIG[source]
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-xs font-bold px-2 py-0.5 rounded-full"
        style={{ color: config.color, backgroundColor: `color-mix(in srgb, ${config.color} 15%, transparent)` }}
      >
        {config.label}
      </span>
      {sourceName && (
        <span className="text-[#6b7280] text-xs truncate max-w-[120px]">{sourceName}</span>
      )}
    </div>
  )
}
