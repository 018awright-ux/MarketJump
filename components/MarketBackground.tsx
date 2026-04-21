'use client'

import { useEffect, useRef } from 'react'

const CHARTS = [
  { label: 'DOW', value: '38,542.61', change: '+171.17', pct: '+0.45%', up: true, seed: 1.4 },
  { label: 'S&P 500', value: '5,204.34', change: '+18.92', pct: '+0.35%', up: true, seed: 2.1 },
  { label: 'NASDAQ', value: '16,396.83', change: '-42.11', pct: '-0.26%', up: false, seed: 0.8 },
  { label: 'NVDA', value: '875.43', change: '+31.20', pct: '+3.67%', up: true, seed: 3.2 },
]

const TICKER = [
  { symbol: 'AAPL', price: '213.49', change: '+2.14%', up: true },
  { symbol: 'NVDA', price: '875.43', change: '+3.67%', up: true },
  { symbol: 'TSLA', price: '248.73', change: '-1.23%', up: false },
  { symbol: 'AMZN', price: '198.12', change: '+1.87%', up: true },
  { symbol: 'META', price: '512.34', change: '+0.94%', up: true },
  { symbol: 'MSFT', price: '421.07', change: '+1.32%', up: true },
  { symbol: 'AMD',  price: '164.82', change: '-0.78%', up: false },
  { symbol: 'SPY',  price: '521.44', change: '+0.61%', up: true },
  { symbol: 'GOOGL', price: '175.23', change: '+1.05%', up: true },
  { symbol: 'BTC',  price: '67,420', change: '+4.21%', up: true },
  { symbol: 'JPM',  price: '198.44', change: '-0.33%', up: false },
  { symbol: 'NFLX', price: '634.21', change: '+2.87%', up: true },
]

// Each chart maintains its own scrolling data buffer
function createChartState(seed: number, up: boolean) {
  const points: number[] = []
  let y = up ? 0.6 : 0.4
  for (let i = 0; i < 120; i++) {
    const noise =
      Math.sin(i * seed * 0.9 + 1) * 0.09 +
      Math.cos(i * seed * 1.7 + 2) * 0.06 +
      Math.sin(i * seed * 3.1 + 0.5) * 0.04 +
      (Math.random() - 0.5) * 0.05
    y = Math.max(0.08, Math.min(0.92, y + noise + (up ? -0.003 : 0.003)))
    points.push(y)
  }
  return points
}

function drawChart(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  points: number[],
  up: boolean,
  label: string,
  value: string,
  change: string,
  pct: string,
  alpha: number = 1
) {
  ctx.save()
  ctx.globalAlpha = alpha

  const color = up ? '#00C805' : '#FF3B30'
  const colorBright = up ? '#00ff06' : '#FF6B60'

  // Background panel — very subtle
  // Label top-left
  ctx.font = 'bold 11px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.fillText(label, x + 16, y + 28)

  // Value
  ctx.font = 'bold 28px monospace'
  ctx.fillStyle = colorBright
  ctx.fillText(value, x + 16, y + 58)

  // Change
  ctx.font = 'bold 13px monospace'
  ctx.fillStyle = up ? '#00C805' : '#FF3B30'
  ctx.fillText(`${change}   ${pct}`, x + 16, y + 78)

  // Draw the chart line
  const chartY = y + 90
  const chartH = h - 90
  const step = w / (points.length - 1)

  // Area fill
  const grad = ctx.createLinearGradient(x, chartY, x, chartY + chartH)
  grad.addColorStop(0, up ? 'rgba(0,200,5,0.35)' : 'rgba(255,59,48,0.35)')
  grad.addColorStop(0.6, up ? 'rgba(0,200,5,0.08)' : 'rgba(255,59,48,0.08)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.beginPath()
  ctx.moveTo(x, chartY + chartH)
  points.forEach((p, i) => {
    ctx.lineTo(x + i * step, chartY + p * chartH)
  })
  ctx.lineTo(x + w, chartY + chartH)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  // Line
  ctx.beginPath()
  ctx.shadowColor = color
  ctx.shadowBlur = 12
  ctx.strokeStyle = colorBright
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  points.forEach((p, i) => {
    const px = x + i * step
    const py = chartY + p * chartH
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  })
  ctx.stroke()
  ctx.shadowBlur = 0

  // End dot
  const lastX = x + (points.length - 1) * step
  const lastY = chartY + points[points.length - 1] * chartH
  ctx.beginPath()
  ctx.arc(lastX, lastY, 3, 0, Math.PI * 2)
  ctx.fillStyle = colorBright
  ctx.shadowColor = colorBright
  ctx.shadowBlur = 10
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.restore()
}

export default function MarketBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const statesRef = useRef(
    CHARTS.map(c => createChartState(c.seed, c.up))
  )
  const frameRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx!.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)

    function tick() {
      if (!canvas || !ctx) return
      frameRef.current++
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight

      ctx.clearRect(0, 0, W, H)

      // Every 3 frames push a new point — faster scroll, more volatile
      if (frameRef.current % 3 === 0) {
        statesRef.current = statesRef.current.map((pts, idx) => {
          const seed = CHARTS[idx].seed
          const up = CHARTS[idx].up
          const last = pts[pts.length - 1]
          const noise =
            Math.sin(frameRef.current * seed * 0.11 + 1) * 0.07 +
            Math.cos(frameRef.current * seed * 0.19 + 2) * 0.05 +
            Math.sin(frameRef.current * seed * 0.37 + 3) * 0.03 +
            (Math.random() - 0.5) * 0.04
          const next = Math.max(0.08, Math.min(0.92, last + noise + (up ? -0.002 : 0.002)))
          return [...pts.slice(1), next]
        })
      }

      // Single full-width floating chart centered on screen
      const padX = 0
      const chartY = H * 0.15
      const chartH = H * 0.7
      drawChart(ctx, padX, chartY, W, chartH, statesRef.current[0], CHARTS[0].up, CHARTS[0].label, CHARTS[0].value, CHARTS[0].change, CHARTS[0].pct, 0.9)

      rafRef.current = requestAnimationFrame(tick)
    }

    tick()
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {/* Canvas — the live chart background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.75 }}
      />

      {/* Dark overlay — keeps foreground content readable */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 100% 100% at 50% 50%, rgba(8,12,20,0.55) 0%, rgba(8,12,20,0.82) 100%)',
        }}
      />

      {/* Ticker tape */}
      <div
        className="absolute top-0 left-0 right-0 h-7 overflow-hidden border-b border-[#C9A84C]/20 z-10"
        style={{ background: 'rgba(8,12,20,0.9)' }}
      >
        <div
          className="flex whitespace-nowrap h-full items-center"
          style={{ animation: 'ticker 35s linear infinite' }}
        >
          {[...TICKER, ...TICKER, ...TICKER].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-4 text-[10px] font-mono">
              <span className="text-[#C9A84C] font-bold">{item.symbol}</span>
              <span className="text-white/70">{item.price}</span>
              <span className={item.up ? 'text-[#00C805]' : 'text-[#FF3B30]'}>{item.change}</span>
              <span className="text-[#C9A84C]/25 ml-2">▪</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
