import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react'

/* ---------------------------------- Panel --------------------------------- */
export function Panel({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className = '',
  provenance,
}: {
  title?: string
  subtitle?: string
  icon?: LucideIcon
  actions?: ReactNode
  children: ReactNode
  className?: string
  provenance?: string
}) {
  return (
    <section className={`panel flex flex-col p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4 shrink-0 text-volt" strokeWidth={1.8} />}
              <h3 className="truncate text-sm font-semibold text-slate-100">{title}</h3>
              {provenance && <ProvenanceTag kind={provenance} />}
            </div>
            {subtitle && <p className="mt-1 text-xs leading-relaxed text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  )
}

/* ------------------------------ Provenance tag ----------------------------- */
const PROV_STYLE: Record<string, string> = {
  MEASURED: 'border-volt/25 bg-volt/10 text-volt',
  CALCULATED: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
  ESTIMATED: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  PREDICTED: 'border-violet-400/25 bg-violet-400/10 text-violet-300',
  SIMULATED: 'border-slate-400/20 bg-slate-400/10 text-slate-400',
  UNAVAILABLE: 'border-white/10 bg-white/5 text-slate-500',
}
export function ProvenanceTag({ kind, title }: { kind: string; title?: string }) {
  return (
    <span
      title={title ?? `${kind} value`}
      className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] ${
        PROV_STYLE[kind] ?? PROV_STYLE.SIMULATED
      }`}
    >
      {kind}
    </span>
  )
}

/* ------------------------------- StatusBadge ------------------------------ */
export type Tone = 'ok' | 'warn' | 'crit' | 'info' | 'idle'
const TONE: Record<Tone, string> = {
  ok: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  warn: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  crit: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
  info: 'border-volt/25 bg-volt/10 text-volt',
  idle: 'border-white/10 bg-white/5 text-slate-400',
}
const DOT: Record<Tone, string> = {
  ok: 'bg-emerald-400',
  warn: 'bg-amber-400',
  crit: 'bg-rose-400',
  info: 'bg-volt',
  idle: 'bg-slate-500',
}
export function StatusBadge({
  tone = 'idle',
  children,
  pulse,
}: {
  tone?: Tone
  children: ReactNode
  pulse?: boolean
}) {
  return (
    <span className={`chip ${TONE[tone]}`}>
      <span className="relative flex h-1.5 w-1.5">
        {pulse && (
          <span className={`absolute inline-flex h-full w-full rounded-full ${DOT[tone]} animate-pulsering`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      </span>
      {children}
    </span>
  )
}

/* ---------------------------- Animated number ----------------------------- */
export function AnimatedNumber({
  value,
  decimals = 2,
  className = '',
}: {
  value: number
  decimals?: number
  className?: string
}) {
  const [display, setDisplay] = useState(value)
  const ref = useRef({ from: value, to: value, start: 0, raf: 0 })
  useEffect(() => {
    const s = ref.current
    s.from = display
    s.to = value
    s.start = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - s.start) / 450)
      const eased = 1 - Math.pow(1 - k, 3)
      setDisplay(s.from + (s.to - s.from) * eased)
      if (k < 1) s.raf = requestAnimationFrame(step)
    }
    cancelAnimationFrame(s.raf)
    s.raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(s.raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <span className={`tabular-nums ${className}`}>
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  )
}

/* -------------------------------- MetricCard ------------------------------ */
export function MetricCard({
  label,
  value,
  unit,
  decimals = 2,
  sub,
  icon: Icon,
  tone = 'info',
  provenance,
  delta,
  progress,
  onClick,
  raw,
}: {
  label: string
  value: number | string
  unit?: string
  decimals?: number
  sub?: ReactNode
  icon?: LucideIcon
  tone?: Tone
  provenance?: string
  delta?: number
  progress?: number
  onClick?: () => void
  raw?: boolean
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`panel panel-hover group relative overflow-hidden p-4 text-left ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="label">{label}</span>
        {Icon && (
          <Icon
            className={`h-4 w-4 ${tone === 'ok' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : tone === 'crit' ? 'text-rose-400' : 'text-volt'}`}
            strokeWidth={1.8}
          />
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="kpi">
          {typeof value === 'number' && !raw ? (
            <AnimatedNumber value={value} decimals={decimals} />
          ) : (
            value
          )}
        </span>
        {unit && <span className="text-sm font-medium text-slate-500">{unit}</span>}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        {typeof delta === 'number' && (
          <span
            className={`inline-flex items-center gap-1 font-medium ${
              delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(1)}%
          </span>
        )}
        {sub}
      </div>
      {typeof progress === 'number' && (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-volt-deep to-volt transition-[width] duration-700"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
      {provenance && (
        <div className="mt-3">
          <ProvenanceTag kind={provenance} />
        </div>
      )}
    </Tag>
  )
}

/* ------------------------------ ConfidenceBar ----------------------------- */
export function ConfidenceBar({
  label,
  value,
  accent = 'volt',
  showPct = true,
}: {
  label: string
  value: number
  accent?: 'volt' | 'ok' | 'warn' | 'slate'
  showPct?: boolean
}) {
  const colors = {
    volt: 'from-cyan-500/70 to-volt',
    ok: 'from-emerald-600/70 to-emerald-400',
    warn: 'from-amber-600/70 to-amber-400',
    slate: 'from-slate-600 to-slate-400',
  }[accent]
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium tracking-wide text-slate-300">{label}</span>
        {showPct && <span className="font-mono text-slate-400">{(value * 100).toFixed(0)}%</span>}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colors} transition-[width] duration-500 ease-out`}
          style={{ width: `${Math.max(2, value * 100)}%` }}
        />
      </div>
    </div>
  )
}

/* --------------------------------- States --------------------------------- */
export function EmptyState({
  title,
  message,
  tone = 'idle',
  action,
}: {
  title: string
  message: string
  tone?: Tone
  action?: ReactNode
}) {
  const Icon = tone === 'crit' ? XCircle : tone === 'warn' ? AlertTriangle : tone === 'ok' ? CheckCircle2 : Info
  const color =
    tone === 'crit'
      ? 'text-rose-400'
      : tone === 'warn'
        ? 'text-amber-400'
        : tone === 'ok'
          ? 'text-emerald-400'
          : 'text-slate-500'
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.015] px-6 py-10 text-center">
      <Icon className={`mb-3 h-6 w-6 ${color}`} strokeWidth={1.6} />
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/**
 * Marks where a classification came from. A heuristic must never be able to
 * pass itself off as a trained model, so the tag is always rendered next to
 * any predicted label.
 */
export function PredictionTag({ source }: { source: string }) {
  const style =
    source === 'ML PREDICTION'
      ? 'border-violet-400/30 bg-violet-400/10 text-violet-300'
      : source === 'DEVICE PREDICTION'
        ? 'border-volt/25 bg-volt/10 text-volt'
        : source === 'UNCLASSIFIED'
          ? 'border-white/10 bg-white/5 text-slate-500'
          : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
  return (
    <span
      title={
        source === 'DEMO PREDICTION'
          ? 'Produced by the demo heuristic classifier — not a trained model.'
          : source === 'ML PREDICTION'
            ? 'Produced by the connected scikit-learn model API.'
            : source === 'DEVICE PREDICTION'
              ? 'Classified on the ESP32 itself.'
              : 'No classifier has labelled this step yet.'
      }
      className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] ${style}`}
    >
      {source}
    </span>
  )
}

export function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-1">
      <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full border transition-colors ${
        checked ? 'border-volt/40 bg-volt/25' : 'border-white/10 bg-white/5'
      } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      <span
        className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${
          checked ? 'left-[18px] bg-volt' : 'left-0.5 bg-slate-400'
        }`}
      />
    </button>
  )
}

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
export const classTone = (c: string): Tone => (c === 'HEAVY' ? 'warn' : c === 'LIGHT' ? 'info' : 'ok')
