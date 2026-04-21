'use client'

import { useState, useEffect } from 'react'

interface MomentumMeterProps {
  bull: number
  bear: number
  size?: 'sm' | 'md'
}

export default function MomentumMeter({ bull, bear, size = 'md' }: MomentumMeterProps) {
  const isSmall = size === 'sm'
  const [displayWidth, setDisplayWidth] = useState(0)

  useEffect(() => {
    // Animate from 0 to actual width on mount
    const timer = setTimeout(() => {
      setDisplayWidth(bull)
    }, 50)
    return () => clearTimeout(timer)
  }, [bull])

  return (
    <div className="w-full">
      {/* Community Sentiment label */}
      <div className={`text-center font-semibold text-[#6b7280] mb-1 ${isSmall ? 'text-[9px]' : 'text-[11px]'} uppercase tracking-widest`}>
        Community Sentiment
      </div>
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
          className="h-full rounded-full bg-[#00C805]"
          style={{
            width: `${displayWidth}%`,
            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  )
}
