'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Loader2 } from 'lucide-react'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setTokens, setUser, accessToken } = useAuthStore()

  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Redirect if already authenticated
  useEffect(() => {
    if (accessToken) {
      router.replace('/dashboard')
    }
  }, [accessToken, router])

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam === 'google_failed') {
      setError('Google sign-in failed. Please try again.')
    }
  }, [searchParams])

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken)
      setUser(data.user)
      router.push('/dashboard')
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken)
      setUser(data.user)
      router.push('/dashboard')
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  const googleAuthUrl = trpc.auth.googleAuthUrl.useQuery(undefined, {
    enabled: false,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (isLogin) {
      loginMutation.mutate({ email, password })
    } else {
      registerMutation.mutate({ name, email, password })
    }
  }

  const handleGoogleLogin = async () => {
    const result = await googleAuthUrl.refetch()
    if (result.data?.url) {
      window.location.href = result.data.url
    }
  }

  const isSubmitting = loginMutation.isPending || registerMutation.isPending

  return (
    <div className="flex min-h-screen w-full overflow-hidden">
      {/* ── LEFT PANEL ── */}
      <div
        className="hidden lg:flex flex-col w-[40%] text-white p-12 justify-between relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #2D264D 0%, #5E50A0 100%)' }}
      >
        {/* Abstract wave pattern overlay */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25'%3E%3Cpath d='M0,50 Q125,0 250,50 T500,50' fill='none' stroke='white' stroke-width='2' opacity='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center font-bold text-xl leading-none" style={{ color: '#5E50A0' }}>
            R
          </div>
          <span className="text-xl font-bold tracking-tight">rectangled.io</span>
        </div>

        {/* Hero content */}
        <div className="relative z-10 space-y-10">
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight max-w-lg">
            Manage your online reputation with AI
          </h1>

          {/* Stat cards — 3 columns */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Reviews Managed', value: '10K+' },
              { label: 'Businesses', value: '500+' },
              { label: 'Rating', value: '4.9★' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col gap-2 rounded-lg p-5"
                style={{
                  background: 'rgba(255,255,255,0.10)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.20)',
                }}
              >
                <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.80)' }}>
                  {stat.label}
                </p>
                <p className="text-2xl font-bold tracking-tight text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-sm" style={{ color: 'rgba(255,255,255,0.60)' }}>
          © 2024 Rectangled.io. All rights reserved.
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="w-full lg:w-[60%] flex flex-col justify-center items-center p-6 sm:p-12 overflow-y-auto bg-white">
        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
          <div className="w-8 h-8 rounded flex items-center justify-center font-bold text-xl text-white leading-none" style={{ background: '#5E50A0' }}>
            R
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">rectangled.io</span>
        </div>

        {/* Form card */}
        <div
          className="w-full bg-white rounded-xl p-8"
          style={{
            maxWidth: '420px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
            border: '1px solid #f1f0f5',
          }}
        >
          {/* Tabs */}
          <div className="flex border-b border-slate-200 mb-8">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError('') }}
              className="flex-1 pb-3 text-center text-sm font-semibold transition-colors"
              style={{
                borderBottom: isLogin ? '2px solid #5E50A0' : '2px solid transparent',
                color: isLogin ? '#5E50A0' : '#64748b',
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError('') }}
              className="flex-1 pb-3 text-center text-sm font-medium transition-colors"
              style={{
                borderBottom: !isLogin ? '2px solid #5E50A0' : '2px solid transparent',
                color: !isLogin ? '#5E50A0' : '#64748b',
              }}
            >
              Create Account
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name (register only) */}
            {!isLogin && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  autoComplete="name"
                  className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 py-2.5 px-3 text-sm shadow-sm outline-none transition-colors"
                  style={{ '--tw-ring-color': '#5E50A0' } as React.CSSProperties}
                  onFocus={(e) => { e.target.style.borderColor = '#5E50A0'; e.target.style.boxShadow = '0 0 0 3px rgba(94,80,160,0.15)' }}
                  onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 py-2.5 px-3 text-sm shadow-sm outline-none transition-colors"
                onFocus={(e) => { e.target.style.borderColor = '#5E50A0'; e.target.style.boxShadow = '0 0 0 3px rgba(94,80,160,0.15)' }}
                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                {isLogin && (
                  <a href="#" className="text-xs font-medium hover:opacity-80 transition-opacity" style={{ color: '#5E50A0' }}>
                    Forgot password?
                  </a>
                )}
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 py-2.5 pl-3 pr-10 text-sm shadow-sm outline-none transition-colors"
                  onFocus={(e) => { e.target.style.borderColor = '#5E50A0'; e.target.style.boxShadow = '0 0 0 3px rgba(94,80,160,0.15)' }}
                  onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full text-white font-medium py-2.5 px-4 rounded-lg shadow-sm transition-opacity text-sm mt-2 disabled:opacity-60"
              style={{ background: '#5E50A0' }}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isLogin ? 'Signing in…' : 'Creating account…'}
                </span>
              ) : isLogin ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative mt-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">Or continue with</span>
            </div>
          </div>

          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="mt-6 w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium py-2.5 px-4 rounded-lg shadow-sm transition-colors text-sm"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Google
          </button>

          {/* Switch mode link */}
          <p className="mt-6 text-center text-sm text-slate-500">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError('') }}
              className="font-semibold hover:opacity-80 transition-opacity"
              style={{ color: '#5E50A0' }}
            >
              {isLogin ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#5E50A0' }} />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
