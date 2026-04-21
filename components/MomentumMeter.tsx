interface MomentumMeterProps {
  bull: number
  bear: number
  size?: 'sm' | 'md'
}

export default function MomentumMeter({ bull, bear, size = 'md' }: MomentumMeterProps) {
  const isSmall = size === 'sm'
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className={`font-bold text-[#00C805] ${isSmall ? 'text-xs' : 'text-sm'}`}>
          🐂 {bull}%
        </span>
        <span className={`font-medium text-[#6b7280] ${isSmall ? 'text-[10px]' : 'text-xs'}`}>
          MOMENTUM
        </span>
        <span className={`font-bold text-[#FF3B30] ${isSmall ? 'text-xs' : 'text-sm'}`}>
          {bear}% 🐻
        </span>
      </div>
      <div className={`w-full rounded-full overflow-hidden bg-[#FF3B30]/30 ${isSmall ? 'h-1.5' : 'h-2'}`}>
        <div
          className="h-full rounded-full bg-[#00C805] transition-all duration-500"
          style={{ width: `${bull}%` }}
        />
      </div>
    </div>
  )
}
