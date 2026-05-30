'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [supabase] = useState<ReturnType<typeof createClient>>(() =>
    typeof window !== 'undefined' ? createClient() : null as unknown as ReturnType<typeof createClient>
  )
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setDone(true)
      setTimeout(() => router.push('/feed'), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-6">
      <div className="mb-10 text-center">
        <div className="text-4xl font-black tracking-tight mb-1">
          <span className="text-[#C9A84C]">Market</span>
          <span className="text-white">Jump</span>
        </div>
      </div>

      <div className="w-full max-w-sm bg-[#12121a] rounded-2xl border border-[#2a2a3a] p-6">
        {done ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-white font-bold text-lg mb-2">Password updated</h2>
            <p className="text-[#6b7280] text-sm">Taking you to the app…</p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-2 text-white">Set new password</h1>
            <p className="text-[#6b7280] text-sm mb-5">Choose a strong password for your account.</p>

            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-xs text-[#6b7280] mb-1.5 uppercase tracking-wider">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-[#1a1a26] border border-[#2a2a3a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
                  placeholder="Min. 8 characters"
                />
              </div>
              <div>
                <label className="block text-xs text-[#6b7280] mb-1.5 uppercase tracking-wider">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  className="w-full bg-[#1a1a26] border border-[#2a2a3a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-[#FF3B30] text-sm bg-[#FF3B30]/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#C9A84C] text-black font-bold py-3 rounded-xl text-sm hover:bg-[#e8c96d] transition-colors disabled:opacity-50"
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
