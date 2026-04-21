import BottomNav from '@/components/BottomNav'
import MarketBackground from '@/components/MarketBackground'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto relative" style={{ background: '#080c14' }}>
      <MarketBackground />
      {/* pt-7 = ticker height, pb-20 = bottom nav, px-0 keeps content centered */}
      <main className="flex-1 overflow-hidden pb-20 pt-7 relative z-10">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
