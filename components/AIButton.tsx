'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'

export default function AIButton() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // On the feed, the action bar occupies the bottom-right — float above it
  const isOnFeed = pathname === '/feed'

  return (
    <>
      {/* Floating AI button — bottom-right, above BottomNav */}
      <button
        onClick={() => setOpen(true)}
        className="fixed z-[100] flex items-center justify-center rounded-full shadow-lg active:scale-90 transition-all"
        style={{
          right: '16px',
          // On feed: float above the ~74px action bar; elsewhere: just above BottomNav
          bottom: isOnFeed
            ? 'calc(env(safe-area-inset-bottom, 0px) + 160px)'
            : 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
          width: '48px',
          height: '48px',
          background: 'linear-gradient(135deg, #1B3066 0%, #6d28d9 100%)',
          boxShadow: '0 0 18px rgba(109,40,217,0.55), 0 4px 12px rgba(0,0,0,0.4)',
          border: '1.5px solid rgba(109,40,217,0.4)',
        }}
        aria-label="AI Assistant"
      >
        {/* Sparkle / AI icon */}
        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l1.09 3.26L16 6.5l-2.91 1.24L12 11l-1.09-3.26L8 6.5l2.91-1.24L12 2z" />
          <path d="M19 14l.73 2.18L22 17l-2.27.82L19 20l-.73-2.18L16 17l2.27-.82L19 14z" />
          <path d="M5 14l.73 2.18L8 17l-2.27.82L5 20l-.73-2.18L2 17l2.27-.82L5 14z" />
        </svg>
      </button>

      {/* Coming Soon modal */}
      {open && (
        <div
          className="fixed inset-0 z-[300] flex items-end justify-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl p-6 pb-10"
            style={{ background: '#0d1422', border: '1px solid rgba(109,40,217,0.3)', borderBottom: 'none' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-[#2a2a3a] mx-auto mb-6" />

            {/* Icon */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, #1B3066, #6d28d9)' }}
            >
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l1.09 3.26L16 6.5l-2.91 1.24L12 11l-1.09-3.26L8 6.5l2.91-1.24L12 2z" />
                <path d="M19 14l.73 2.18L22 17l-2.27.82L19 20l-.73-2.18L16 17l2.27-.82L19 14z" />
                <path d="M5 14l.73 2.18L8 17l-2.27.82L5 20l-.73-2.18L2 17l2.27-.82L5 14z" />
              </svg>
            </div>

            <h2 className="text-white font-black text-xl text-center mb-2">MarketJump AI</h2>
            <p className="text-[#6b7280] text-sm text-center mb-6 leading-relaxed">
              Ask anything about stocks, markets, and investing.<br />
              &ldquo;What is an ETF?&rdquo; · &ldquo;Explain P/E ratio&rdquo; · &ldquo;Is NVDA overvalued?&rdquo;
            </p>

            {/* Coming Soon badge */}
            <div
              className="flex items-center justify-center gap-2 py-3 rounded-2xl mb-4"
              style={{ background: 'rgba(109,40,217,0.12)', border: '1px solid rgba(109,40,217,0.3)' }}
            >
              <svg className="w-4 h-4 text-[#a855f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[#a855f7] font-bold text-sm">Coming Soon</span>
            </div>

            <p className="text-[#4b5563] text-xs text-center">
              AI-powered market education is being built. Stay tuned.
            </p>

            <button
              onClick={() => setOpen(false)}
              className="w-full mt-5 py-3 rounded-2xl text-[#6b7280] text-sm font-bold"
              style={{ background: 'rgba(30,45,74,0.4)' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
