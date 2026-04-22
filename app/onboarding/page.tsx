'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserLevel, Sector } from '@/lib/types'

const LEVELS: { id: UserLevel; label: string; icon: string; description: string }[] = [
  {
    id: 'rookie',
    label: 'Rookie',
    icon: '📈',
    description: 'New to markets. I want to learn market concepts with plain explanations and growing my understanding.',
  },
  {
    id: 'analyst',
    label: 'Analyst',
    icon: '📊',
    description: 'I know the basics. Give me context, data, and real analysis. Challenge my thinking when the data says otherwise.',
  },
  {
    id: 'shark',
    label: 'Shark',
    icon: '🦈',
    description: 'Full technical language. I want raw analysis, contrarian views, and no hand-holding.',
  },
]

const SECTORS: Sector[] = [
  'Tech', 'Energy', 'Healthcare', 'Finance', 'Crypto',
  'Commodities', 'Real Estate', 'Macro', 'Options', 'Index Funds',
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<'level' | 'brand' | 'interests'>('level')
  const [level, setLevel] = useState<UserLevel | null>(null)
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
    if (!level || interests.length === 0) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    await supabase.from('profiles').update({
      level,
      interests,
      brand_name: brandName || null,
      onboarding_complete: true,
    }).eq('id', user.id)

    router.push('/feed')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Header */}
      <div className="text-center pt-12 pb-6 px-6">
        <div className="text-3xl font-black tracking-tight mb-1">
          <span className="text-[#00C805]">Market</span>
          <span className="text-white">Jump</span>
        </div>
        <p className="text-[#6b7280] text-sm">Let's personalize your experience</p>
      </div>

      {/* Progress */}
      <div className="flex gap-2 px-6 mb-8">
        <div className="flex-1 h-1 rounded-full bg-[#00C805]" />
        <div className={`flex-1 h-1 rounded-full transition-colors ${step === 'brand' || step === 'interests' ? 'bg-[#00C805]' : 'bg-[#2a2a3a]'}`} />
        <div className={`flex-1 h-1 rounded-full transition-colors ${step === 'interests' ? 'bg-[#00C805]' : 'bg-[#2a2a3a]'}`} />
      </div>

      <div className="flex-1 px-6 overflow-y-auto">
        {/* Back button */}
        {step !== 'level' && (
          <button
            onClick={() => setStep(step === 'interests' ? 'brand' : 'level')}
            className="text-[#6b7280] text-sm mb-4 hover:text-white"
          >
            ← Back
          </button>
        )}

        {step === 'level' && (
          <div className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-2">What's your level?</h2>
            <p className="text-[#6b7280] text-sm mb-6">This shapes how our AI explains market moves to you. You can always change it later.</p>
            <div className="space-y-3">
              {LEVELS.map(l => (
                <button
                  key={l.id}
                  onClick={() => setLevel(l.id)}
                  className={`w-full text-left rounded-2xl border p-5 transition-all ${
                    level === l.id
                      ? 'border-[#00C805] bg-[#00C805]/10'
                      : 'border-[#2a2a3a] bg-[#12121a] hover:border-[#3a3a4a]'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{l.icon}</span>
                    <span className="font-bold text-white text-lg">{l.label}</span>
                    {level === l.id && (
                      <span className="ml-auto w-5 h-5 rounded-full bg-[#00C805] flex items-center justify-center">
                        <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="text-[#6b7280] text-sm leading-relaxed">{l.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'brand' && (
          <div className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-2">Claim your brand name</h2>
            <p className="text-[#6b7280] text-sm mb-6">This is your identity on MarketJump. Others will follow your brand and track your moves.</p>

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

            <p className="text-[#6b7280] text-xs text-center mt-4">You can always change this later in your profile settings.</p>
          </div>
        )}

        {step === 'interests' && (
          <div className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-2">Pick your markets</h2>
            <p className="text-[#6b7280] text-sm mb-6">Select any sectors you want to track. This shapes your Jump Feed.</p>
            <div className="grid grid-cols-3 gap-3">
              {SECTORS.map(sector => (
                <button
                  key={sector}
                  onClick={() => toggleInterest(sector)}
                  className={`rounded-xl border py-3 px-2 text-sm font-medium transition-all ${
                    interests.includes(sector)
                      ? 'border-[#00C805] bg-[#00C805]/10 text-[#00C805]'
                      : 'border-[#2a2a3a] bg-[#12121a] text-[#6b7280] hover:border-[#3a3a4a] hover:text-white'
                  }`}
                >
                  {sector}
                </button>
              ))}
            </div>
            {interests.length > 0 && (
              <p className="text-[#00C805] text-xs mt-4">{interests.length} selected</p>
            )}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="p-6 pt-4 space-y-3">
        {step === 'level' && (
          <>
            <button
              onClick={() => setStep('brand')}
              disabled={!level}
              className="w-full bg-[#00C805] text-black font-bold py-4 rounded-2xl text-base hover:bg-[#00e006] transition-colors disabled:opacity-40"
            >
              Continue →
            </button>
            <button
              onClick={() => setStep('brand')}
              className="w-full text-[#6b7280] text-sm py-2 hover:text-white transition-colors"
            >
              Skip for now
            </button>
          </>
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
              className="w-full bg-[#00C805] text-black font-bold py-4 rounded-2xl text-base hover:bg-[#00e006] transition-colors"
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
              disabled={loading}
              className="w-full bg-[#00C805] text-black font-bold py-4 rounded-2xl text-base hover:bg-[#00e006] transition-colors disabled:opacity-40"
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
