import { useState, useEffect } from 'react'
import { Zap, ShieldCheck, Loader2, ArrowRight } from 'lucide-react'
import heroImg from '../assets/stepcharge-hero.jpg'
import { getGoogleLoginUrl, devLogin } from '../services/api/authService'

export default function Login({ onSignIn }: { onSignIn: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authErr = params.get('auth_error')
    if (authErr) {
      if (authErr === 'missing_code') {
        setError('Google authentication was cancelled or returned without an authorization code.')
      } else if (authErr === 'oauth_failed') {
        setError('Google sign-in could not be completed. Please try again.')
      } else {
        setError('Google sign-in could not be completed. Please try again.')
      }
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const handleGoogleLogin = async () => {
    setError(null)
    setBusy(true)
    try {
      const url = await getGoogleLoginUrl()
      window.location.href = url
    } catch (err) {
      setError((err as Error).message || 'Failed to initialize Google OAuth login.')
      setBusy(false)
    }
  }

  const handleDemoAccess = async () => {
    setBusy(true)
    try {
      await devLogin()
    } catch {
      // offline / mock mode fallback
    }
    localStorage.setItem('stepcharge.mode', 'demo')
    onSignIn()
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hero-intro relative hidden rounded-none border-0 lg:block">
        <img
          src={heroImg}
          alt="Piezoelectric smart floor tile harvesting footstep energy"
          width={1600}
          height={912}
          className="hero-intro__img"
        />
        <div className="hero-intro__veil" />
        <div className="absolute bottom-0 left-0 max-w-md p-10">
          <span className="eyebrow">Smart footstep energy harvesting</span>
          <h2 className="display mt-4">Turn Every Footstep Into Intelligent Energy.</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Piezoelectric harvesting, ESP32 telemetry, and machine learning — unified on MongoDB Atlas.
          </p>
        </div>
      </aside>

      <div className="grid place-items-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-volt/25 bg-volt/10">
              <Zap className="h-6 w-6 text-volt" strokeWidth={2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-white">StepCharge AI</h1>
            <p className="mt-1.5 text-xs text-slate-500">
              Turning Human Footsteps into Intelligent Energy Data.
            </p>
          </div>

          <div className="panel space-y-4 p-6">
            <div className="flex items-start gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.06] p-2.5 text-[11px] text-emerald-200">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Google OAuth 2.0 — Secure server-side token verification with HTTP-only cookies and MongoDB Atlas.
              </span>
            </div>

            {error && (
              <p className="rounded-lg border border-rose-400/25 bg-rose-400/[0.07] p-2.5 text-[11px] text-rose-200">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleGoogleLogin()}
              className="btn btn-primary h-14 w-full justify-center py-2.5 text-sm font-medium shadow-lg shadow-cyan-500/10 transition-all hover:-translate-y-0.5 hover:shadow-cyan-500/20 focus-visible:ring-2 focus-visible:ring-volt/70 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
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
              )}
              {busy ? 'Connecting to Google…' : 'Continue with Google'}
            </button>

            <div className="relative flex items-center justify-center">
              <span className="absolute inset-x-0 border-t border-white/[0.06]" />
              <span className="relative bg-ink-900 px-2 text-[10px] uppercase text-slate-500">or</span>
            </div>

            <button
              type="button"
              onClick={handleDemoAccess}
              className="btn btn-ghost w-full justify-center py-2 text-xs text-amber-300/90 hover:bg-amber-400/10 hover:text-amber-200"
            >
              <span>Explore in Demo Mode (Simulated Data)</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>

            <p className="text-center text-[10px] text-slate-500">
              Live telemetry is protected by Google OAuth and MongoDB role-based access control.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
