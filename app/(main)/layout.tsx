import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import MarketBackground from '@/components/MarketBackground'
import TickerTape from '@/components/TickerTape'
import AIButton from '@/components/AIButton'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col max-w-lg mx-auto relative overflow-hidden" style={{ background: '#080c14', height: '100dvh' }}>
      <MarketBackground />

      {/*
        Fixed header: ticker tape (h-9 = 36px) + nav row (~44px) = ~80px total
        z-50 sits above the background (z-0) and content (z-10)
      */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 flex flex-col"
        style={{ background: 'rgba(8,12,20,0.0)', paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Row 1: live ticker tape */}
        <TickerTape />

        {/* Row 2: notification bell + settings gear */}
        <div
          className="flex items-center justify-end px-4 py-2 gap-1 border-b border-[#C9A84C]/10"
          style={{ background: 'rgba(8,12,20,0.88)', backdropFilter: 'blur(12px)' }}
        >
          <Link
            href="/notifications"
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-white/5 active:bg-white/10"
          >
            <svg className="w-5 h-5 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </Link>
          <Link
            href="/settings"
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors hover:bg-white/5 active:bg-white/10"
          >
            <svg className="w-5 h-5 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </div>

      {/* pt = safe-area-top + ticker(36px) + nav-row(44px); pb = bottom nav(64px) + safe-area-bottom */}
      <main
        className="flex-1 overflow-hidden relative"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 80px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)',
        }}
      >
        {children}
      </main>
      <BottomNav />
      <AIButton />
    </div>
  )
}
