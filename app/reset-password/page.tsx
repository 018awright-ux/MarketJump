'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [supabase] = useState(() => createClient())
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const code = searchParams.get('code')

    if (code) {
      // PKCE flow — exchange the code for a session
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        setInitializing(false)
        if (error) {
          setError('This reset link is invalid or has expired. Please request a new one.')
        } else {
          setSessionReady(true)
        }
      })
    } else {
      // No code — check if there's already an active session (e.g. hash-based flow)
      supabase.auth.getSession().then(({ data: { session } }) => {
        setInitializing(false)
        if (session) {
          setSessionReady(true)
        } else {
          setError('No valid reset session found. Please request a new password reset link.')
        }
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
        ) : initializing ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[#6b7280] text-sm">Verifying reset link…</p>
          </div>
        ) : !sessionReady ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-white font-bold text-lg mb-2">Link expired</h2>
            <p className="text-[#6b7280] text-sm mb-5">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="text-[#C9A84C] text-sm hover:underline"
            >
              Back to sign in
            </button>
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
