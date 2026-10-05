import { useState } from 'react'
import { Zap, LogIn, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react'
import heroImg from '../assets/stepcharge-hero.jpg'
import { authMode, signIn } from '../services/firebase/authService'

/**
 * Two honest sign-in paths:
 *
 *  - Firebase configured → REAL email/password authentication. The ID token is
 *    what the hardened security rules check, so this is not decorative.
 *  - Not configured      → a clearly-labelled local gate that unlocks DEMO
 *    (simulated) data only. It is explicitly not a security boundary.
 */
export default function Login({ onSignIn }: { onSignIn: () => void }) {
  const mode = authMode()
  const real = mode === 'firebase'

  const [email, setEmail] = useState(real ? '' : 'demo@stepcharge.ai')
  const [password, setPassword] = useState(real ? '' : 'demo')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!real) return onSignIn() // demo gate — nothing to authenticate against
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      onSignIn()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="hero-intro relative hidden rounded-none border-0 lg:block">
        <img src={heroImg} alt="Piezoelectric smart floor tile harvesting footstep energy" width={1600} height={912} className="hero-intro__img" />
        <div className="hero-intro__veil" />
        <div className="absolute bottom-0 left-0 max-w-md p-10">
          <span className="eyebrow">Smart footstep energy harvesting</span>
          <h2 className="display mt-4">Turn Every Footstep Into Intelligent Energy.</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">Piezoelectric harvesting, ESP32 telemetry and machine learning — in one monitoring platform.</p>
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

        <form className="panel space-y-4 p-6" onSubmit={(e) => void submit(e)}>
          <div
            className={`flex items-start gap-2 rounded-lg border p-2.5 text-[11px] ${
              real
                ? 'border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-200'
                : 'border-amber-400/25 bg-amber-400/[0.06] text-amber-200'
            }`}
          >
            {real ? (
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <span>
              {real
                ? 'Firebase Authentication — credentials are verified against your Firebase project.'
                : 'DEMO ACCESS — Firebase is not configured. This gate is not a security boundary and unlocks simulated data only.'}
            </span>
          </div>

          <label className="block">
            <span className="label">Email</span>
            <input
              className="input mt-1.5"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input
              className="input mt-1.5"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && (
            <p className="rounded-lg border border-rose-400/25 bg-rose-400/[0.07] p-2.5 text-[11px] text-rose-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn btn-primary w-full justify-center py-2.5 text-sm disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-center text-[11px] text-slate-600">
            {real
              ? 'Create the user in Firebase Console → Authentication → Users.'
              : 'Set VITE_FIREBASE_* in .env.local to enable real authentication and live data.'}
          </p>
        </form>
      </div>
      </div>
    </div>
  )
}
