'use client'

import { useEffect, useState } from 'react'

interface TickerItem {
  symbol: string
  price: number | null
  changePct: number | null
  up: boolean
}

const FALLBACK: TickerItem[] = [
  { symbol: 'AAPL',  price: 213.49, changePct:  2.14, up: true  },
  { symbol: 'NVDA',  price: 875.43, changePct:  3.67, up: true  },
  { symbol: 'TSLA',  price: 248.73, changePct: -1.23, up: false },
  { symbol: 'AMZN',  price: 198.12, changePct:  1.87, up: true  },
  { symbol: 'META',  price: 512.34, changePct:  0.94, up: true  },
  { symbol: 'MSFT',  price: 421.07, changePct:  1.32, up: true  },
  { symbol: 'AMD',   price: 164.82, changePct: -0.78, up: false },
  { symbol: 'GOOGL', price: 175.23, changePct:  1.05, up: true  },
  { symbol: 'JPM',   price: 198.44, changePct: -0.33, up: false },
  { symbol: 'SPY',   price: 521.44, changePct:  0.61, up: true  },
]

function fmt(p: number | null) {
  if (p === null) return '—'
  return p >= 1000
    ? p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : p.toFixed(2)
}

export default function TickerTape() {
  const [tickers, setTickers] = useState<TickerItem[]>(FALLBACK)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/ticker')
        const data = await res.json()
        if (data.tickers?.length > 0) setTickers(data.tickers)
      } catch { /* keep fallback */ }
    }
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

  const items = [...tickers, ...tickers, ...tickers]

  return (
    <div
      className="w-full h-9 overflow-hidden border-b border-[#C9A84C]/30 flex items-center"
      style={{ background: 'rgba(8,12,20,0.97)' }}
    >
      <div
        className="flex whitespace-nowrap items-center h-full"
        style={{ animation: 'ticker 40s linear infinite' }}
      >
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 px-5 text-xs font-mono flex-shrink-0">
            <span className="text-[#C9A84C] font-bold tracking-wider">{item.symbol}</span>
            <span className="text-white/80 font-medium">{fmt(item.price)}</span>
            <span className={`font-semibold ${item.up ? 'text-[#00C805]' : 'text-[#FF3B30]'}`}>
              {item.changePct !== null
                ? `${item.changePct >= 0 ? '+' : ''}${item.changePct.toFixed(2)}%`
                : ''}
            </span>
            <span className="text-[#C9A84C]/30">▪</span>
          </span>
        ))}
      </div>
    </div>
  )
}
