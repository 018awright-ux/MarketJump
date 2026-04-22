import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
import type { UserLevel } from '@/lib/types'
import LevelBadge from '@/components/LevelBadge'

interface BrandProfile {
  id: string
  username: string
  brand_name: string | null
  brand_tagline: string | null
  brand_avatar_url: string | null
  brand_logo_url: string | null
  level: UserLevel
  market_score: number
  accuracy: number
  total_predictions: number
  correct_predictions: number
  agreed_count: number
  disagreed_count: number
}

interface Prediction {
  id: string
  ticker: string
  prediction: string
  price_at_prediction: number
  result: string
  created_at: string
  resolved: boolean
}

async function fetchBrandData(brandname: string): Promise<{ profile: BrandProfile | null; predictions: Prediction[] }> {
  const supabase = await createClient()

  // Try brand_name first (case-insensitive)
  let { data: profile } = await supabase
    .from('profiles')
    .select('id, username, brand_name, brand_tagline, brand_avatar_url, brand_logo_url, level, market_score, accuracy, total_predictions, correct_predictions, agreed_count, disagreed_count')
    .ilike('brand_name', brandname)
    .single()

  // Fallback to username
  if (!profile) {
    const { data: byUsername } = await supabase
      .from('profiles')
      .select('id, username, brand_name, brand_tagline, brand_avatar_url, brand_logo_url, level, market_score, accuracy, total_predictions, correct_predictions, agreed_count, disagreed_count')
      .ilike('username', brandname)
      .single()
    profile = byUsername
  }

  if (!profile) return { profile: null, predictions: [] }

  const { data: predictions } = await supabase
    .from('predictions')
    .select('id, ticker, prediction, price_at_prediction, result, created_at, resolved')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(5)

  return { profile: profile as BrandProfile, predictions: (predictions ?? []) as Prediction[] }
}

function computeStreak(preds: Prediction[]): { type: 'hot' | 'cold' | 'none'; count: number } {
  const resolved = preds.filter(p => p.resolved && (p.result === 'correct' || p.result === 'incorrect'))
  if (resolved.length === 0) return { type: 'none', count: 0 }
  const first = resolved[0].result
  let count = 0
  for (const p of resolved) {
    if (p.result === first) count++
    else break
  }
  if (first === 'correct' && count >= 3) return { type: 'hot', count }
  if (first === 'incorrect' && count >= 2) return { type: 'cold', count }
  return { type: 'none', count: 0 }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ brandname: string }>
}): Promise<Metadata> {
  const { brandname } = await params
  const { profile } = await fetchBrandData(brandname)

  if (!profile) {
    return {
      title: 'Brand Not Found | MarketJump',
      description: 'This brand does not exist on MarketJump.',
    }
  }

  const displayName = profile.brand_name || profile.username
  const tagline = profile.brand_tagline ?? 'Track record verified on MarketJump'
  const description = `${tagline} — Brand Score: ${profile.market_score} | Accuracy: ${profile.accuracy?.toFixed(1)}%`

  return {
    title: `${displayName} | MarketJump`,
    description,
    openGraph: {
      title: `${displayName} on MarketJump`,
      description: tagline,
      url: `https://marketjump.com/${brandname}`,
    },
    twitter: {
      card: 'summary',
      title: `${displayName} on MarketJump`,
      description,
    },
  }
}

export default async function PublicBrandPage({
  params,
}: {
  params: Promise<{ brandname: string }>
}) {
  const { brandname } = await params
  const { profile, predictions } = await fetchBrandData(brandname)

  if (!profile) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: '#080c14' }}
      >
        <div className="text-[#C9A84C] text-4xl mb-4">⚡</div>
        <h1 className="text-white font-black text-2xl mb-2">Brand Not Found</h1>
        <p className="text-[#9ca3af] text-sm text-center mb-8">
          This brand doesn&apos;t exist on MarketJump yet.
        </p>
        <a
          href="/signup"
          className="px-6 py-3 rounded-xl font-black text-black text-sm"
          style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96d)' }}
        >
          Build Your Brand
        </a>
      </div>
    )
  }

  const displayName = profile.brand_name || profile.username
  const streak = computeStreak(predictions)
  const totalVotes = (profile.agreed_count || 0) + (profile.disagreed_count || 0)
  const agreedPct = totalVotes > 0 ? Math.round((profile.agreed_count / totalVotes) * 100) : 0

  return (
    <div className="min-h-screen max-w-lg mx-auto" style={{ background: '#080c14' }}>
      {/* Top nav */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between border-b border-[#C9A84C]/10">
        <span className="text-[#C9A84C] font-black text-xl tracking-tight">MarketJump</span>
        <a
          href="/login"
          className="text-[#9ca3af] text-xs border border-[#C9A84C]/20 rounded-lg px-3 py-1.5 hover:text-[#C9A84C] transition-colors"
        >
          Log in
        </a>
      </div>

      {/* Header */}
      <div className="px-5 pt-6 pb-5 border-b border-[#C9A84C]/10">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0">
            {profile.brand_logo_url ? (
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#C9A84C]/40">
                <img src={profile.brand_logo_url} alt={displayName} className="w-full h-full object-cover" />
              </div>
            ) : profile.brand_avatar_url ? (
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#C9A84C]/20">
                <img src={profile.brand_avatar_url} alt={displayName} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#C9A84C]/20 border-2 border-[#C9A84C]/40 flex items-center justify-center">
                <span className="text-[#C9A84C] text-2xl font-black">
                  {displayName.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-white leading-tight">{displayName}</h1>
            {profile.brand_tagline && (
              <p className="text-[#9ca3af] text-sm italic mt-1 leading-snug">{profile.brand_tagline}</p>
            )}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <LevelBadge level={profile.level} />
              {streak.type === 'hot' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 text-xs font-bold">
                  🔥 {streak.count} move streak
                </span>
              )}
              {streak.type === 'cold' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 text-xs font-bold">
                  ❄️ Cold streak ({streak.count})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Key stats row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Brand Score', value: profile.market_score.toLocaleString(), color: '#C9A84C' },
            { label: 'Accuracy', value: `${profile.accuracy?.toFixed(1)}%`, color: '#00C805' },
            { label: 'Total Moves', value: profile.total_predictions, color: 'white' },
            { label: 'Agreed By', value: profile.agreed_count, color: '#C9A84C' },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-[rgba(8,12,20,0.88)] rounded-xl border border-[#C9A84C]/20 p-2.5 text-center backdrop-blur-md"
            >
              <div className="font-black text-sm" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-[#6b7280] text-[9px] uppercase tracking-wider mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Credibility bar */}
        {totalVotes > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-[10px] text-[#9ca3af] mb-1">
              <span>Agreed by {profile.agreed_count} traders</span>
              <span>{agreedPct}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#2a2a3a] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${agreedPct}%`,
                  background: agreedPct >= 50 ? '#00C805' : '#FF3B30',
                }}
              />
            </div>
            <div className="text-[#6b7280] text-[9px] mt-0.5">Votes weighted by Brand Score</div>
          </div>
        )}
      </div>

      {/* Recent Moves */}
      <div className="px-5 py-5">
        <div className="text-[#9ca3af] text-xs uppercase tracking-wider font-bold mb-3">
          Recent Moves
        </div>
        {predictions.length === 0 ? (
          <div className="text-center py-8 text-[#6b7280] text-sm">No moves yet.</div>
        ) : (
          <div className="space-y-2">
            {predictions.map(pred => (
              <div
                key={pred.id}
                className="bg-[rgba(8,12,20,0.88)] rounded-xl border border-[#C9A84C]/20 p-3 flex items-center justify-between backdrop-blur-md"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-[#1B3066]/60 text-[#C9A84C] text-xs font-black">
                      {pred.ticker}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      pred.prediction === 'bullish'
                        ? 'bg-[#00C805]/15 text-[#00C805]'
                        : 'bg-[#FF3B30]/15 text-[#FF3B30]'
                    }`}>
                      {pred.prediction === 'bullish' ? '🐂 Bull' : '🐻 Bear'}
                    </span>
                  </div>
                  <div className="text-[#9ca3af] text-xs mt-1">
                    Called at ${pred.price_at_prediction?.toFixed(2)} · {new Date(pred.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  {pred.result === 'correct' ? (
                    <span className="text-[#00C805] text-xs bg-[#00C805]/10 px-2 py-1 rounded-lg">✓ Correct</span>
                  ) : pred.result === 'incorrect' ? (
                    <span className="text-[#FF3B30] text-xs bg-[#FF3B30]/10 px-2 py-1 rounded-lg">✗ Wrong</span>
                  ) : (
                    <span className="text-[#6b7280] text-xs bg-[#1a1a26] px-2 py-1 rounded-lg">⏳ Pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Big CTA */}
      <div className="px-5 pb-10 pt-2">
        <div
          className="rounded-2xl border border-[#C9A84C]/20 p-6 text-center"
          style={{ background: 'rgba(8,12,20,0.95)' }}
        >
          <a
            href="/signup"
            className="block w-full py-4 rounded-xl font-black text-black text-base mb-3 transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96d)' }}
          >
            Join MarketJump to Track {displayName}&apos;s Moves
          </a>
          <p className="text-[#9ca3af] text-sm">
            Verify your own track record. Build your brand.
          </p>
        </div>
      </div>
    </div>
  )
}
