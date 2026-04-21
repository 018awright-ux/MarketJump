'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!agreed) {
      setError('You must agree to the terms to continue.')
      return
    }
    setLoading(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Update username in profile
      await supabase.from('profiles').update({ username }).eq('id', data.user.id)
      router.push('/onboarding')
      router.refresh()
    }
  }

  async function handleGoogleSignup() {
    if (!agreed) {
      setError('You must agree to the terms to continue.')
      return
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/onboarding` },
    })
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-6">
      <div className="mb-10 text-center">
        <div className="text-4xl font-black tracking-tight mb-1">
          <span className="text-[#C9A84C]">Market</span>
          <span className="text-white">Jump</span>
        </div>
        <p className="text-[#6b7280] text-sm">Jump the market before it moves.</p>
      </div>

      <div className="w-full max-w-sm bg-[#12121a] rounded-2xl border border-[#2a2a3a] p-6">
        <h1 className="text-xl font-bold mb-6 text-white">Create account</h1>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5 uppercase tracking-wider">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={24}
              pattern="[a-zA-Z0-9_]+"
              className="w-full bg-[#1a1a26] border border-[#2a2a3a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
              placeholder="your_handle"
            />
          </div>
          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-[#1a1a26] border border-[#2a2a3a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-[#1a1a26] border border-[#2a2a3a] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C9A84C] transition-colors"
              placeholder="Min. 6 characters"
            />
          </div>

          {/* Waiver */}
          <div className="bg-[#1a1a26] rounded-xl p-3 border border-[#2a2a3a]">
            <p className="text-[#6b7280] text-xs leading-relaxed mb-3">
              MarketJump is a discovery platform. All content is public opinion and information only.{' '}
              <strong className="text-white">Not financial advice.</strong> By signing up you agree to
              our terms of service and confirm you understand this is for entertainment and information purposes only.
            </p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 accent-[#00C805]"
              />
              <span className="text-xs text-white">I agree to the terms and understand this is not financial advice</span>
            </label>
          </div>

          {error && (
            <p className="text-[#FF3B30] text-sm bg-[#FF3B30]/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1B3066] text-white font-bold py-3 rounded-xl text-sm hover:bg-[#2a4a8a] transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-[#2a2a3a]" />
          <span className="text-[#6b7280] text-xs">or</span>
          <div className="flex-1 h-px bg-[#2a2a3a]" />
        </div>

        <button
          onClick={handleGoogleSignup}
          disabled={loading}
          className="w-full bg-[#1a1a26] border border-[#2a2a3a] text-white font-medium py-3 rounded-xl text-sm hover:border-[#3a3a4a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <p className="text-center text-[#6b7280] text-sm mt-6">
          Have an account?{' '}
          <Link href="/login" className="text-[#C9A84C] hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
