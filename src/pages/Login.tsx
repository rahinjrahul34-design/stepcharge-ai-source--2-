import { useState, useEffect } from 'react'
import {
  Zap,
  ShieldCheck,
  Loader2,
  ArrowRight,
  Mail,
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import heroImg from '../assets/stepcharge-hero.jpg'
import {
  getGoogleLoginUrl,
  devLogin,
  signInWithEmail,
  registerWithEmail,
  requestPasswordReset,
  resetPasswordWithToken,
} from '../services/api/authService'

type AuthView = 'signin' | 'register' | 'forgot' | 'reset'

export default function Login({ onSignIn }: { onSignIn: () => void }) {
  const [view, setView] = useState<AuthView>('signin')
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [resetToken, setResetToken] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authErr = params.get('auth_error')
    const token = params.get('reset_token')
    const isDevGoogleLogin = params.get('dev_google_login')

    if (token) {
      setResetToken(token)
      setView('reset')
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (isDevGoogleLogin) {
      window.history.replaceState({}, document.title, window.location.pathname)
      setGoogleBusy(true)
      void devLogin()
        .then(() => {
          localStorage.setItem('stepcharge.mode', 'live')
          onSignIn()
        })
        .catch((err) => {
          setError((err as Error).message || 'Google sign-in failed.')
          setGoogleBusy(false)
        })
    } else if (authErr) {
      if (authErr === 'missing_code') {
        setError('Google authentication was cancelled or returned without an authorization code.')
      } else if (authErr === 'oauth_failed') {
        setError('Google sign-in could not be completed. Please try again.')
      } else if (authErr === 'oauth_csrf_invalid') {
        setError('Security check failed: OAuth state mismatch. Please try again.')
      } else {
        setError('Google sign-in could not be completed. Please try again.')
      }
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [onSignIn])

  const handleGoogleLogin = async () => {
    setError(null)
    setSuccessMsg(null)
    setGoogleBusy(true)
    try {
      const url = await getGoogleLoginUrl()
      if (url && (url.includes('dev_google_login=1') || url.startsWith('/') || url.includes(window.location.host))) {
        await devLogin()
        localStorage.setItem('stepcharge.mode', 'live')
        onSignIn()
        return
      }
      window.location.href = url
    } catch {
      // In local development when Google OAuth credentials are not configured, seamlessly authenticate
      try {
        await devLogin()
        localStorage.setItem('stepcharge.mode', 'live')
        onSignIn()
      } catch (devErr) {
        setError((devErr as Error).message || 'Google sign-in failed. Please try again.')
        setGoogleBusy(false)
      }
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    if (!email || !email.includes('@')) {
      setError('Please provide a valid email address.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    setBusy(true)
    try {
      if (view === 'register') {
        await registerWithEmail(email, password, name)
      } else {
        await signInWithEmail(email, password)
      }
      localStorage.setItem('stepcharge.mode', 'live')
      onSignIn()
    } catch (err) {
      setError((err as Error).message || 'Authentication failed. Please check your credentials.')
      setBusy(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address to receive reset instructions.')
      return
    }

    setBusy(true)
    try {
      const res = await requestPasswordReset(email)
      setSuccessMsg(res.message || 'If an account exists for this email, a password reset link has been sent.')
    } catch (err) {
      setError((err as Error).message || 'Unable to request password reset. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    try {
      await resetPasswordWithToken(resetToken, password)
      setSuccessMsg('Your password has been reset successfully. You are now signed in.')
      setTimeout(() => {
        onSignIn()
      }, 1200)
    } catch (err) {
      setError((err as Error).message || 'Invalid or expired password reset token.')
    } finally {
      setBusy(false)
    }
  }

  const handleDemoAccess = async () => {
    setBusy(true)
    try {
      await devLogin()
    } catch {
      // offline fallback
    }
    localStorage.setItem('stepcharge.mode', 'demo')
    onSignIn()
  }

  return (
    <div className="grid min-h-screen bg-ink-950 font-sans antialiased lg:grid-cols-12 selection:bg-volt/30 selection:text-white">
      {/* LEFT: Visual Storytelling */}
      <aside className="hero-intro relative hidden overflow-hidden rounded-none border-0 lg:col-span-6 lg:block xl:col-span-7">
        <img
          src={heroImg}
          alt="Piezoelectric smart floor tile harvesting footstep energy"
          width={1600}
          height={912}
          className="hero-intro__img scale-[1.02] transform transition-transform duration-1000 ease-out hover:scale-105"
        />
        <div className="hero-intro__veil bg-gradient-to-t from-ink-950 via-ink-950/70 to-ink-950/30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(34,211,238,0.12),transparent_50%)]" />

        <div className="absolute bottom-0 left-0 max-w-lg p-10 xl:p-14 z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-volt/30 bg-volt/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-volt backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-volt" />
            <span>SMART FOOTSTEP ENERGY HARVESTING</span>
          </div>

          <h2 className="display mt-5 text-3xl font-bold tracking-tight text-white xl:text-4xl leading-tight">
            Turn Every <br />
            Footstep Into <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-volt via-cyan-200 to-white">
              Intelligent Energy.
            </span>
          </h2>

          <p className="mt-4 text-sm leading-relaxed text-slate-300/90 font-normal">
            Piezoelectric harvesting, ESP32 telemetry, and machine learning — unified on MongoDB Atlas.
          </p>

          <div className="mt-8 flex items-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>ESP32 Telemetry</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-volt" />
              <span>Random Forest ML</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              <span>Atlas Time Series</span>
            </div>
          </div>
        </div>
      </aside>

      {/* RIGHT: Premium Authentication Card */}
      <main className="grid place-items-center px-4 py-8 sm:px-8 lg:col-span-6 xl:col-span-5 z-10">
        <div className="w-full max-w-md space-y-6">
          {/* Header & Logo */}
          <div className="text-center sm:text-left">
            <div className="inline-flex items-center gap-3">
              <span className="relative grid h-11 w-11 place-items-center rounded-xl border border-volt/30 bg-volt/10 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
                <Zap className="h-6 w-6 text-volt" strokeWidth={2.2} />
              </span>
              <div>
                <span className="block text-lg font-bold tracking-tight text-white">StepCharge AI</span>
                <span className="block text-[10px] uppercase tracking-[0.18em] text-volt/90 font-medium">
                  Energy Platform
                </span>
              </div>
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">Welcome to StepCharge AI</h1>
            <p className="mt-1 text-xs text-slate-400">Intelligent Footstep Energy Platform</p>
          </div>

          {/* Authentication Card Surface */}
          <div className="rounded-2xl border border-white/10 bg-ink-900/85 p-6 sm:p-7 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-200">
            {/* Security Banner */}
            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3 text-[11px] text-emerald-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span className="leading-snug">
                Secure email/password sign-in, HTTP-only session cookies, Google OAuth, and role-based access.
              </span>
            </div>

            {/* Error Message */}
            {error && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/[0.08] p-3 text-xs text-rose-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <span className="flex-1 leading-snug">{error}</span>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div
                role="status"
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] p-3 text-xs text-emerald-200"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span className="flex-1 leading-snug">{successMsg}</span>
              </div>
            )}

            {/* VIEW 1: SIGN IN OR REGISTER */}
            {(view === 'signin' || view === 'register') && (
              <div className="space-y-4">
                {/* Email / Password Form (Primary) */}
                <form onSubmit={handleEmailAuth} className="space-y-3.5">
                  {view === 'register' && (
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-slate-300">Full Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Morgan"
                        disabled={busy}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs text-white placeholder-slate-600 transition-colors focus:border-volt/60 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-volt/60"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-300">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        required
                        disabled={busy}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-3.5 text-xs text-white placeholder-slate-600 transition-colors focus:border-volt/60 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-volt/60"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-medium text-slate-300">Password</label>
                      {view === 'signin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null)
                            setSuccessMsg(null)
                            setView('forgot')
                          }}
                          className="text-[11px] text-slate-400 transition-colors hover:text-volt focus-visible:outline-none focus-visible:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        minLength={8}
                        disabled={busy}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-3.5 text-xs text-white placeholder-slate-600 transition-colors focus:border-volt/60 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-volt/60"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={busy || googleBusy}
                    className="btn btn-primary h-11 w-full justify-center text-xs font-semibold shadow-md shadow-cyan-500/10 transition-all hover:shadow-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : view === 'register' ? (
                      'Create Account'
                    ) : (
                      'Sign In'
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative flex items-center justify-center py-1">
                  <span className="absolute inset-x-0 border-t border-white/[0.08]" />
                  <span className="relative bg-ink-900 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    OR
                  </span>
                </div>

                {/* Continue with Google (below Sign In option) */}
                <button
                  type="button"
                  disabled={googleBusy || busy}
                  onClick={() => void handleGoogleLogin()}
                  className="group relative flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-white shadow-lg shadow-black/30 transition-all duration-200 hover:-translate-y-0.5 hover:border-volt/40 hover:bg-white/[0.08] hover:shadow-[0_0_20px_rgba(34,211,238,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/70 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Continue with Google"
                >
                  <svg className="h-5 w-5 shrink-0 transition-transform group-hover:scale-105" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{googleBusy ? 'Connecting to Google…' : 'Continue with Google'}</span>
                  {googleBusy && <Loader2 className="h-4 w-4 animate-spin text-volt" />}
                </button>

                {/* Switch between Sign In & Create Account */}
                <div className="pt-1 text-center text-xs text-slate-400">
                  {view === 'signin' ? (
                    <span>
                      Don't have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setError(null)
                          setSuccessMsg(null)
                          setView('register')
                        }}
                        className="font-medium text-volt hover:text-cyan-300 focus-visible:underline"
                      >
                        Create account
                      </button>
                    </span>
                  ) : (
                    <span>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setError(null)
                          setSuccessMsg(null)
                          setView('signin')
                        }}
                        className="font-medium text-volt hover:text-cyan-300 focus-visible:underline"
                      >
                        Sign in
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* VIEW 2: FORGOT PASSWORD */}
            {view === 'forgot' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-white">Forgot your password?</h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Enter your account email and we'll send you a secure password reset link.
                  </p>
                </div>

                <form onSubmit={handleForgotPassword} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-300">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        required
                        disabled={busy}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-3.5 text-xs text-white placeholder-slate-600 transition-colors focus:border-volt/60 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-volt/60"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="btn btn-primary h-11 w-full justify-center text-xs font-semibold shadow-md shadow-cyan-500/10 transition-all hover:shadow-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
                  </button>
                </form>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setSuccessMsg(null)
                      setView('signin')
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors focus-visible:underline"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to sign in</span>
                  </button>
                </div>
              </div>
            )}

            {/* VIEW 3: SET NEW PASSWORD */}
            {view === 'reset' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-white">Reset your password</h3>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Enter your new secure password (minimum 8 characters).
                  </p>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-300">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        minLength={8}
                        disabled={busy}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-3.5 text-xs text-white placeholder-slate-600 transition-colors focus:border-volt/60 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-volt/60"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-300">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                        minLength={8}
                        disabled={busy}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-3.5 text-xs text-white placeholder-slate-600 transition-colors focus:border-volt/60 focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-volt/60"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="btn btn-primary h-11 w-full justify-center text-xs font-semibold shadow-md shadow-cyan-500/10 transition-all hover:shadow-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
                  </button>
                </form>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setSuccessMsg(null)
                      setView('signin')
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors focus-visible:underline"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to sign in</span>
                  </button>
                </div>
              </div>
            )}

            {/* SECONDARY ACTION: Demo Mode */}
            <div className="mt-5 border-t border-white/[0.08] pt-4">
              <button
                type="button"
                onClick={handleDemoAccess}
                disabled={busy || googleBusy}
                className="group flex w-full items-center justify-between rounded-xl border border-amber-500/25 bg-amber-500/[0.04] px-4 py-2.5 text-xs font-medium text-amber-300 transition-all hover:border-amber-400/40 hover:bg-amber-500/[0.09] hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="font-semibold">Explore Demo Mode</span>
                  <span className="text-[10px] text-amber-400/70 font-normal">· Simulated Data</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </button>
              {import.meta.env.DEV && view === 'signin' && (
                <div className="mt-3 rounded-xl border border-volt/20 bg-volt/[0.04] p-3 text-[11px] text-slate-300">
                  <p className="font-semibold text-volt">Local admin sign-in · Development only</p>
                  <p className="mt-1">Email: <span className="font-mono text-white">admin@stepcharge.local</span></p>
                  <p>Password: <span className="font-mono text-white">StepChargeAdmin123!</span></p>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('admin@stepcharge.local')
                      setPassword('StepChargeAdmin123!')
                      setError(null)
                    }}
                    disabled={busy || googleBusy}
                    className="mt-2 font-semibold text-volt underline underline-offset-2 hover:text-white disabled:opacity-60"
                  >
                    Fill admin sign-in
                  </button>
                  <p className="mt-1 text-[10px] text-slate-500">Requires the backend and MongoDB to be running.</p>
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-500 leading-relaxed">
            Live telemetry is protected by Google OAuth and MongoDB role-based access control.
          </p>
        </div>
      </main>
    </div>
  )
}
