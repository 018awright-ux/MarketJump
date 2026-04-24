export default function PullIndicator({
  pullDistance,
  refreshing,
}: {
  pullDistance: number
  refreshing: boolean
}) {
  if (!refreshing && pullDistance === 0) return null
  return (
    <div
      className="w-full flex items-center justify-center pointer-events-none transition-all duration-150"
      style={{
        height: refreshing ? 40 : pullDistance * 0.5,
        opacity: refreshing ? 1 : Math.min(pullDistance / 60, 1),
      }}
    >
      <div
        className={`w-5 h-5 rounded-full border-2 border-[#C9A84C] border-t-transparent ${
          refreshing ? 'animate-spin' : ''
        }`}
        style={{ transform: refreshing ? undefined : `rotate(${pullDistance * 3}deg)` }}
      />
    </div>
  )
}
