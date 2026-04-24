'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense } from 'react'

const NAV_ITEMS = [
  {
    href: '/explore',
    label: 'Markets',
    icon: (active: boolean) => (
      <svg className={`w-6 h-6 ${active ? 'text-[#C9A84C]' : 'text-[#6b7280]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        {/* Candlestick wicks */}
        <line x1="5"  y1="3"  x2="5"  y2="6"  strokeWidth={active ? 2.5 : 2} />
        <line x1="5"  y1="13" x2="5"  y2="18" strokeWidth={active ? 2.5 : 2} />
        <line x1="12" y1="2"  x2="12" y2="5"  strokeWidth={active ? 2.5 : 2} />
        <line x1="12" y1="14" x2="12" y2="19" strokeWidth={active ? 2.5 : 2} />
        <line x1="19" y1="4"  x2="19" y2="8"  strokeWidth={active ? 2.5 : 2} />
        <line x1="19" y1="16" x2="19" y2="20" strokeWidth={active ? 2.5 : 2} />
        {/* Candlestick bodies */}
        <rect x="3"  y="6"  width="4" height="7"  rx="0.5" strokeWidth={active ? 2.5 : 2} />
        <rect x="10" y="5"  width="4" height="9"  rx="0.5" strokeWidth={active ? 2.5 : 2} />
        <rect x="17" y="8"  width="4" height="8"  rx="0.5" strokeWidth={active ? 2.5 : 2} />
      </svg>
    ),
  },
  {
    href: '/watchlist',
    label: 'Tracklist',
    icon: (active: boolean) => (
      <svg className={`w-6 h-6 ${active ? 'text-[#C9A84C]' : 'text-[#6b7280]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    ),
  },
  {
    href: '/feed',
    label: 'Jump',
    icon: (active: boolean) => (
      <svg className={`w-6 h-6 ${active ? 'text-[#C9A84C]' : 'text-[#6b7280]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    href: '/leaderboard',
    label: 'Leaders',
    icon: (active: boolean) => (
      <svg className={`w-6 h-6 ${active ? 'text-[#C9A84C]' : 'text-[#6b7280]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (active: boolean) => (
      <svg className={`w-6 h-6 ${active ? 'text-[#C9A84C]' : 'text-[#6b7280]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
]

function BottomNavInner() {
  const pathname = usePathname()

  return (
    <div className="flex items-center justify-around py-2 px-2">
      {NAV_ITEMS.map(item => {
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors min-w-[56px]"
          >
            {item.icon(active)}
            <span className={`text-[10px] font-medium ${active ? 'text-[#C9A84C]' : 'text-[#6b7280]'}`}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg backdrop-blur-xl border-t border-[#C9A84C]/20 z-50" style={{ background: 'rgba(8,12,20,0.96)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <Suspense fallback={
        <div className="flex items-center justify-around py-2 px-2">
          {NAV_ITEMS.map(item => (
            <div key={item.href} className="flex flex-col items-center gap-1 py-1 px-3 min-w-[56px]">
              {item.icon(false)}
              <span className="text-[10px] font-medium text-[#6b7280]">{item.label}</span>
            </div>
          ))}
        </div>
      }>
        <BottomNavInner />
      </Suspense>
    </nav>
  )
}
