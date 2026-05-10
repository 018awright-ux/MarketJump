'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TIER_CONFIG, TIER_ORDER } from '@/lib/tier'
import type { Sector } from '@/lib/types'

const SECTORS: Sector[] = [
  'Tech', 'Energy', 'Healthcare', 'Finance', 'Crypto',
  'Commodities', 'Real Estate', 'Macro', 'Options', 'Index Funds',
]

type Step = 'tiers' | 'brand' | 'interests'

export default function OnboardingPage() {
  const router = useRouter()
  const [supabase] = useState<ReturnType<typeof createClient>>(
    () => (typeof window !== 'undefined' ? createClient() : null) as ReturnType<typeof createClient>
  )
  const [step, setStep] = useState<Step>('tiers')
  const [brandName, setBrandName] = useState('')
  const [brandNameError, setBrandNameError] = useState('')
  const [interests, setInterests] = useState<Sector[]>([])
  const [loading, setLoading] = useState(false)
  const [brandFocused, setBrandFocused] = useState(false)

  function toggleInterest(sector: Sector) {
    setInterests(prev =>
      prev.includes(sector) ? prev.filter(s => s !== sector) : [...prev, sector]
    )
  }

  async function handleFinish() {
    if (interests.length === 0) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    await supabase.from('profiles').update({
      level: 'rookie',          // everyone starts at Rookie; cron upgrades based on score
      interests,
      brand_name: brandName || null,
      onboarding_complete: true,
    }).eq('id', user.id)

    router.push('/feed')
    router.refresh()
  }

  const stepIndex: Record<Step, number> = { tiers: 0, brand: 1, interests: 2 }
  const currentIndex = stepIndex[step]

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Header */}
      <div className="text-center pt-12 pb-6 px-6">
        <div className="text-3xl font-black tracking-tight mb-1">
          <span className="text-[#C9A84C]">Market</span>
          <span className="text-white">Jump</span>
        </div>
        <p className="text-[#6b7280] text-sm">Let's personalize your experience</p>
      </div>

      {/* Progress */}
      <div className="flex gap-2 px-6 mb-8">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full transition-colors"
            style={{ background: i <= currentIndex ? '#C9A84C' : '#2a2a3a' }}
          />
        ))}
      </div>

      <div className="flex-1 px-6 overflow-y-auto">
        {/* Back button */}
        {step !== 'tiers' && (
          <button
            onClick={() => setStep(step === 'interests' ? 'brand' : 'tiers')}
            className="text-[#6b7280] text-sm mb-4 hover:text-white"
          >
            ← Back
          </button>
        )}

        {/* ── STEP 1: Tier Showcase ── */}
        {step === 'tiers' && (
          <div className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-1">How you rank up</h2>
            <p className="text-[#6b7280] text-sm mb-6">
              Your tier is earned automatically from your market score and accuracy.
              Everyone starts as a Rookie — the grind begins now.
            </p>

            <div className="space-y-3">
              {TIER_ORDER.map((tierId, idx) => {
                const t = TIER_CONFIG[tierId]
                const isGuru = tierId === 'guru'
                return (
                  <div
                    key={tierId}
                    className="rounded-2xl border p-4"
                    style={{
                      borderColor: idx === 0 ? t.color : `${t.color}40`,
                      background: idx === 0
                        ? `color-mix(in srgb, ${t.color} 12%, #12121a)`
                        : '#12121a',
                    }}
                  >
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-2xl">{t.icon}</span>
                      <span className="font-black text-white">{t.label}</span>
                      {idx === 0 && (
                        <span
                          className="ml-auto text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
                          style={{ background: `${t.color}25`, color: t.color }}
                        >
                          You start here
                        </span>
                      )}
                      {isGuru && (
                        <span
                          className="ml-auto text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
                          style={{ background: `${t.color}25`, color: t.color }}
                        >
                          Losable
                        </span>
                      )}
                    </div>
                    <p
                      className="text-sm mb-1"
                      style={{ color: t.color, fontWeight: 700 }}
                    >
                      {t.description}
                    </p>
                    <p className="text-[#6b7280] text-xs">{t.threshold}</p>
                  </div>
                )
              })}
            </div>

            <p className="text-[#4b5563] text-xs text-center mt-5">
              Tiers recalculate every Friday. Guru can be lost if you drop below 7,000 pts, 50 calls, or 60% accuracy.
            </p>
          </div>
        )}

        {/* ── STEP 2: Brand Name ── */}
        {step === 'brand' && (
          <div className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-2">Claim your brand name</h2>
            <p className="text-[#6b7280] text-sm mb-6">
              This is your identity on MarketJump. Others will follow your brand and track your moves.
            </p>

            <div className="mb-2">
              <input
                type="text"
                placeholder="@yourbrandname"
                value={brandName}
                onFocus={() => setBrandFocused(true)}
                onBlur={() => setBrandFocused(false)}
                onChange={e => {
                  const val = e.target.value
                  if (/^[a-zA-Z0-9_]*$/.test(val) && val.length <= 20) {
                    setBrandName(val.toLowerCase())
                    setBrandNameError('')
                  }
                }}
                style={{
                  background: 'rgba(13,20,34,0.8)',
                  borderColor: brandNameError
                    ? 'rgb(239,68,68)'
                    : brandFocused
                    ? 'rgba(201,168,76,0.5)'
                    : 'rgba(30,45,74,0.8)',
                }}
                className="w-full border rounded-xl px-4 py-4 text-white text-lg font-bold focus:outline-none"
              />
              {brandNameError ? (
                <p className="text-red-500 text-xs mt-1">{brandNameError}</p>
              ) : (
                <p className="text-[#6b7280] text-xs mt-1 text-right">{brandName.length}/20</p>
              )}
            </div>

            {brandName.length > 0 && (
              <div className="rounded-full px-4 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] text-sm text-center mb-4">
                marketjump.com/{brandName}
              </div>
            )}

            <div className="flex gap-2 mb-4">
              {['TechBull', 'SharkTrader', 'OptionQueen'].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => { setBrandName(suggestion.toLowerCase()); setBrandNameError('') }}
                  className="rounded-full px-3 py-1.5 border border-[#2a2a3a] bg-[#12121a] text-[#6b7280] text-sm hover:text-white hover:border-[#3a3a4a] transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <p className="text-[#6b7280] text-xs text-center mt-4">
              You can always change this later in your profile settings.
            </p>
          </div>
        )}

        {/* ── STEP 3: Interests ── */}
        {step === 'interests' && (
          <div className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-2">Pick your markets</h2>
            <p className="text-[#6b7280] text-sm mb-6">
              Select any sectors you want to track. This shapes your Jump Feed.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {SECTORS.map(sector => (
                <button
                  key={sector}
                  onClick={() => toggleInterest(sector)}
                  className={`rounded-xl border py-3 px-2 text-sm font-medium transition-all ${
                    interests.includes(sector)
                      ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]'
                      : 'border-[#2a2a3a] bg-[#12121a] text-[#6b7280] hover:border-[#3a3a4a] hover:text-white'
                  }`}
                >
                  {sector}
                </button>
              ))}
            </div>
            {interests.length > 0 && (
              <p className="text-[#C9A84C] text-xs mt-4">{interests.length} selected</p>
            )}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="p-6 pt-4 space-y-3">
        {step === 'tiers' && (
          <button
            onClick={() => setStep('brand')}
            className="w-full text-black font-bold py-4 rounded-2xl text-base transition-colors"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96d)' }}
          >
            Let's go →
          </button>
        )}

        {step === 'brand' && (
          <>
            <button
              onClick={() => {
                if (brandName.length > 0 && brandName.length < 3) {
                  setBrandNameError('Brand name must be at least 3 characters.')
                  return
                }
                setStep('interests')
              }}
              className="w-full text-black font-bold py-4 rounded-2xl text-base transition-colors"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96d)' }}
            >
              Continue →
            </button>
            <button
              onClick={() => setStep('interests')}
              className="w-full text-[#6b7280] text-sm py-2 hover:text-white transition-colors"
            >
              Skip for now
            </button>
          </>
        )}

        {step === 'interests' && (
          <>
            <button
              onClick={handleFinish}
              disabled={loading || interests.length === 0}
              className="w-full text-black font-bold py-4 rounded-2xl text-base transition-colors disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96d)' }}
            >
              {loading ? 'Setting up...' : 'Jump In →'}
            </button>
            <button
              onClick={handleFinish}
              disabled={loading}
              className="w-full text-[#6b7280] text-sm py-2 hover:text-white transition-colors"
            >
              Skip
            </button>
          </>
        )}
      </div>
    </div>
  )
}
