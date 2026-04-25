'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LevelBadge from '@/components/LevelBadge'
import type { UserLevel } from '@/lib/types'

const LEVELS: { id: UserLevel; label: string; icon: string; description: string }[] = [
  {
    id: 'rookie',
    label: 'Rookie',
    icon: '📈',
    description: 'New to markets. Plain explanations and growing your understanding.',
  },
  {
    id: 'analyst',
    label: 'Analyst',
    icon: '📊',
    description: 'I know the basics. Give me context, data, and real analysis.',
  },
  {
    id: 'shark',
    label: 'Shark',
    icon: '🦈',
    description: 'Full technical language. Raw analysis, contrarian views, no hand-holding.',
  },
]

interface Profile {
  id: string
  username: string
  level: UserLevel
}

interface ToggleSetting {
  key: string
  label: string
  value: boolean
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
      style={{ background: on ? '#C9A84C' : '#2a2a3a' }}
      aria-checked={on}
      role="switch"
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
        style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [supabase] = useState<ReturnType<typeof createClient>>(
    () => (typeof window !== 'undefined' ? createClient() : null) as ReturnType<typeof createClient>
  )

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Username edit state
  const [editingUsername, setEditingUsername] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)
  const [usernameError, setUsernameError] = useState('')

  // Level modal state
  const [levelModalOpen, setLevelModalOpen] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState<UserLevel | null>(null)
  const [savingLevel, setSavingLevel] = useState(false)

  // Notification toggles
  const [toggles, setToggles] = useState<ToggleSetting[]>([
    { key: 'prediction_results', label: 'Prediction results', value: true },
    { key: 'new_followers', label: 'New followers', value: true },
    { key: 'price_alerts', label: 'Price alerts', value: false },
    { key: 'market_moves', label: 'Market moves', value: false },
  ])

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data } = await supabase
      .from('profiles')
      .select('id, username, level')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data as Profile)
      setUsernameInput(data.username)
      setSelectedLevel(data.level)
    }
    setLoading(false)
  }

  async function handleSaveUsername() {
    if (!profile) return
    const trimmed = usernameInput.trim()
    if (!trimmed) { setUsernameError('Username cannot be empty'); return }
    if (trimmed.length < 3) { setUsernameError('Must be at least 3 characters'); return }
    setSavingUsername(true)
    setUsernameError('')
    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmed })
      .eq('id', profile.id)
    if (error) {
      setUsernameError('Username already taken or invalid')
    } else {
      setProfile(prev => prev ? { ...prev, username: trimmed } : prev)
      setEditingUsername(false)
    }
    setSavingUsername(false)
  }

  function handleCancelUsername() {
    if (profile) setUsernameInput(profile.username)
    setUsernameError('')
    setEditingUsername(false)
  }

  async function handleSaveLevel() {
    if (!profile || !selectedLevel) return
    setSavingLevel(true)
    const { error } = await supabase
      .from('profiles')
      .update({ level: selectedLevel })
      .eq('id', profile.id)
    if (!error) {
      setProfile(prev => prev ? { ...prev, level: selectedLevel } : prev)
    }
    setSavingLevel(false)
    setLevelModalOpen(false)
  }

  function toggleNotif(key: string) {
    setToggles(prev => prev.map(t => t.key === key ? { ...t, value: !t.value } : t))
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[#6b7280] text-sm animate-pulse">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {/* Header */}
        <div className="flex items-center gap-3 pt-5 pb-2">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-black text-white">Settings</h1>
        </div>

        {/* ACCOUNT section */}
        <p className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-widest mb-2 mt-5">Account</p>
        <div className="space-y-2">
          {/* Username row */}
          <div
            className="rounded-2xl border p-4"
            style={{ background: '#12121a', borderColor: '#2a2a3a' }}
          >
            {!editingUsername ? (
              <button
                onClick={() => setEditingUsername(true)}
                className="w-full flex items-center justify-between"
              >
                <span className="text-white font-medium text-sm">Username</span>
                <div className="flex items-center gap-2">
                  <span className="text-[#6b7280] text-sm">{profile?.username}</span>
                  <svg className="w-4 h-4 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ) : (
              <div>
                <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-2 block">Username</label>
                <input
                  autoFocus
                  className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none border transition-colors mb-2"
                  style={{ background: '#0d0d16', borderColor: usernameError ? '#FF3B30' : '#C9A84C' }}
                  value={usernameInput}
                  onChange={e => { setUsernameInput(e.target.value); setUsernameError('') }}
                  placeholder="Enter username"
                  maxLength={30}
                />
                {usernameError && (
                  <p className="text-[#FF3B30] text-xs mb-2">{usernameError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelUsername}
                    className="flex-1 py-2 rounded-xl text-xs font-bold border border-[#2a2a3a] text-[#6b7280]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveUsername}
                    disabled={savingUsername}
                    className="flex-1 py-2 rounded-xl text-xs font-black text-black disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96d)' }}
                  >
                    {savingUsername ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Level row */}
          <button
            onClick={() => { setSelectedLevel(profile?.level ?? 'rookie'); setLevelModalOpen(true) }}
            className="w-full rounded-2xl border p-4 flex items-center justify-between"
            style={{ background: '#12121a', borderColor: '#2a2a3a' }}
          >
            <span className="text-white font-medium text-sm">Level</span>
            <div className="flex items-center gap-2">
              {profile && <LevelBadge level={profile.level} />}
              <svg className="w-4 h-4 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>

        {/* NOTIFICATIONS section */}
        <p className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-widest mb-2 mt-5">Notifications</p>
        <div className="space-y-2">
          {toggles.map(t => (
            <div
              key={t.key}
              className="rounded-2xl border p-4 flex items-center justify-between"
              style={{ background: '#12121a', borderColor: '#2a2a3a' }}
            >
              <span className="text-white font-medium text-sm">{t.label}</span>
              <Toggle on={t.value} onToggle={() => toggleNotif(t.key)} />
            </div>
          ))}
        </div>

        {/* APP section */}
        <p className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-widest mb-2 mt-5">App</p>
        <div className="space-y-2">
          {[
            { label: 'Privacy Policy', href: '#' },
            { label: 'Terms of Service', href: '#' },
            { label: 'Rate the app', href: '#' },
          ].map(item => (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-2xl border p-4"
              style={{ background: '#12121a', borderColor: '#2a2a3a' }}
            >
              <span className="text-white font-medium text-sm">{item.label}</span>
              <svg className="w-4 h-4 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ))}
        </div>

        {/* DANGER ZONE section */}
        <p className="text-[#C9A84C] text-[10px] font-bold uppercase tracking-widest mb-2 mt-5">Danger Zone</p>
        <button
          onClick={handleSignOut}
          className="w-full rounded-2xl border p-4 flex items-center justify-between"
          style={{ background: '#12121a', borderColor: '#2a2a3a' }}
        >
          <span className="font-bold text-sm" style={{ color: '#FF3B30' }}>Sign Out</span>
          <svg className="w-4 h-4" style={{ color: '#FF3B30' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      {/* Level modal */}
      {levelModalOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setLevelModalOpen(false) }}
        >
          <div
            className="rounded-t-3xl border-t overflow-y-auto max-h-[80vh]"
            style={{ background: 'rgba(8,12,20,0.98)', borderColor: 'rgba(201,168,76,0.2)' }}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-white font-black text-lg">Change Level</h2>
                <button
                  onClick={() => setLevelModalOpen(false)}
                  className="text-[#6b7280] hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-[#6b7280] text-sm mb-5">This shapes how the AI explains market moves to you.</p>

              <div className="space-y-3 mb-6">
                {LEVELS.map(l => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedLevel(l.id)}
                    className="w-full text-left rounded-2xl border p-4 transition-all"
                    style={
                      selectedLevel === l.id
                        ? { borderColor: '#C9A84C', background: 'rgba(201,168,76,0.1)' }
                        : { borderColor: '#2a2a3a', background: '#12121a' }
                    }
                  >
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-2xl">{l.icon}</span>
                      <span className="font-bold text-white">{l.label}</span>
                      {selectedLevel === l.id && (
                        <span
                          className="ml-auto w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: '#C9A84C' }}
                        >
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

              <button
                onClick={handleSaveLevel}
                disabled={savingLevel || selectedLevel === profile?.level}
                className="w-full py-3.5 rounded-xl font-black text-sm text-black transition-opacity disabled:opacity-50 pb-safe"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #e8c96d)' }}
              >
                {savingLevel ? 'Saving...' : 'Save Level'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
