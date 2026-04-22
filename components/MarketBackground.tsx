'use client'

import { useEffect, useRef, useState } from 'react'

interface TickerItem {
  symbol: string
  price: number | null
  change: number | null
  changePct: number | null
  up: boolean
}

const FALLBACK_TICKERS: TickerItem[] = [
  { symbol: 'AAPL', price: 213.49, change: 4.51, changePct: 2.14, up: true },
  { symbol: 'NVDA', price: 875.43, change: 31.20, changePct: 3.67, up: true },
  { symbol: 'TSLA', price: 248.73, change: -3.10, changePct: -1.23, up: false },
  { symbol: 'AMZN', price: 198.12, change: 3.64, changePct: 1.87, up: true },
  { symbol: 'META', price: 512.34, change: 4.76, changePct: 0.94, up: true },
  { symbol: 'MSFT', price: 421.07, change: 5.49, changePct: 1.32, up: true },
  { symbol: 'AMD',  price: 164.82, change: -1.30, changePct: -0.78, up: false },
  { symbol: 'GOOGL', price: 175.23, change: 1.82, changePct: 1.05, up: true },
  { symbol: 'JPM',  price: 198.44, change: -0.66, changePct: -0.33, up: false },
  { symbol: 'SPY',  price: 521.44, change: 3.18, changePct: 0.61, up: true },
]

function formatPrice(p: number | null): string {
  if (p === null) return '—'
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return p.toFixed(2)
}

function formatChange(pct: number | null): string {
  if (pct === null) return ''
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

// Lerp between two hex colors by t (0..1)
function lerpColor(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t)
  const g = Math.round(a[1] + (b[1] - a[1]) * t)
  const bl = Math.round(a[2] + (b[2] - a[2]) * t)
  return `rgb(${r},${g},${bl})`
}

const GREEN: [number, number, number] = [0, 200, 5]
const YELLOW: [number, number, number] = [201, 168, 76]
const RED: [number, number, number] = [255, 59, 48]

function getMomentumColor(points: number[]): string {
  // Compare last 20 points vs previous 20 — rising = green, falling = red
  if (points.length < 40) return lerpColor(GREEN, RED, 0.5)
  const recent = points.slice(-20).reduce((a, b) => a + b, 0) / 20
  const prev = points.slice(-40, -20).reduce((a, b) => a + b, 0) / 20
  const delta = recent - prev // positive = line went up in canvas coords = price DOWN (inverted y)
  // canvas y: 0 = top, 1 = bottom. So lower y = higher price = bullish
  const normalized = Math.max(-1, Math.min(1, delta * 10))
  if (normalized < 0) {
    // going up (price rising) → green
    return lerpColor(YELLOW, GREEN, -normalized)
  } else {
    // going down (price falling) → red
    return lerpColor(YELLOW, RED, normalized)
  }
}

function createInitialPoints(): number[] {
  const points: number[] = []
  let y = 0.5
  for (let i = 0; i < 120; i++) {
    const noise =
      Math.sin(i * 1.4 * 0.9 + 1) * 0.09 +
      Math.cos(i * 1.4 * 1.7 + 2) * 0.06 +
      Math.sin(i * 1.4 * 3.1 + 0.5) * 0.04 +
      Math.sin(i * 73.1 + 17.3) * 0.025
    y = Math.max(0.08, Math.min(0.92, y + noise))
    points.push(y)
  }
  return points
}

export default function MarketBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const pointsRef = useRef<number[]>(createInitialPoints())
  const frameRef = useRef(0)
  const [tickers, setTickers] = useState<TickerItem[]>(FALLBACK_TICKERS)

  // Fetch real ticker data
  useEffect(() => {
    async function loadTickers() {
      try {
        const res = await fetch('/api/ticker')
        const data = await res.json()
        if (data.tickers?.length > 0) setTickers(data.tickers)
      } catch { /* keep fallback */ }
    }
    loadTickers()
    const interval = setInterval(loadTickers, 60_000)
    return () => clearInterval(interval)
  }, [])

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

      // Push new point every 3 frames
      if (frameRef.current % 3 === 0) {
        const f = frameRef.current
        const last = pointsRef.current[pointsRef.current.length - 1]
        const noise =
          Math.sin(f * 1.4 * 0.11 + 1) * 0.07 +
          Math.cos(f * 1.4 * 0.19 + 2) * 0.05 +
          Math.sin(f * 1.4 * 0.37 + 3) * 0.03 +
          Math.sin(f * 97.3 + 31.7) * 0.0275
        const next = Math.max(0.08, Math.min(0.92, last + noise))
        pointsRef.current = [...pointsRef.current.slice(1), next]
      }

      const points = pointsRef.current
      const color = getMomentumColor(points)

      const chartY = H * 0.12
      const chartH = H * 0.76
      const step = W / (points.length - 1)

      // Area fill
      const grad = ctx.createLinearGradient(0, chartY, 0, chartY + chartH)
      grad.addColorStop(0, color.replace('rgb', 'rgba').replace(')', ',0.25)'))
      grad.addColorStop(0.65, color.replace('rgb', 'rgba').replace(')', ',0.05)'))
      grad.addColorStop(1, 'rgba(0,0,0,0)')

      ctx.beginPath()
      ctx.moveTo(0, chartY + chartH)
      points.forEach((p, i) => ctx.lineTo(i * step, chartY + p * chartH))
      ctx.lineTo(W, chartY + chartH)
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.fill()

      // Line
      ctx.beginPath()
      ctx.shadowColor = color
      ctx.shadowBlur = 14
      ctx.strokeStyle = color
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      points.forEach((p, i) => {
        const px = i * step
        const py = chartY + p * chartH
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      })
      ctx.stroke()
      ctx.shadowBlur = 0

      // Glowing end dot
      const lastX = (points.length - 1) * step
      const lastY = chartY + points[points.length - 1] * chartH
      ctx.beginPath()
      ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 16
      ctx.fill()
      ctx.shadowBlur = 0

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
      {/* Volatility canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.7 }}
      />

      {/* Dark radial overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 100% 100% at 50% 50%, rgba(8,12,20,0.55) 0%, rgba(8,12,20,0.85) 100%)',
        }}
      />

      {/* Ticker tape is now rendered in layout.tsx above the nav row */}
    </div>
  )
}
