import { useEffect, useState, type ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  Bell,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  Database,
  Footprints,
  FlaskConical,
  Gauge,
  Info,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Settings as SettingsIcon,
  Signal,
  UserRound,
  Wifi,
  WifiOff,
  X,
  XCircle,
  Zap,
  type LucideIcon,
  LogOut,
} from 'lucide-react'
import { useStore } from '../data/store'
import { StatusBadge, fmtDateTime } from './ui'
import type { AlertCategory, AlertSeverity, RangeKey } from '../data/types'

export type PageKey =
  | 'overview'
  | 'live'
  | 'footsteps'
  | 'energy'
  | 'ai'
  | 'model'
  | 'history'
  | 'health'
  | 'settings'

export const NAV: { key: PageKey; label: string; icon: LucideIcon }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'live', label: 'Live Monitoring', icon: Activity },
  { key: 'footsteps', label: 'Footstep Analytics', icon: Footprints },
  { key: 'energy', label: 'Energy Analytics', icon: Zap },
  { key: 'ai', label: 'AI Insights', icon: BrainCircuit },
  { key: 'model', label: 'AI Model', icon: FlaskConical },
  { key: 'history', label: 'History', icon: Database },
  { key: 'health', label: 'System Health', icon: Gauge },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
]

const MOBILE_NAV: PageKey[] = ['overview', 'live', 'footsteps', 'ai', 'health']

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center rounded-lg border border-volt/25 bg-volt/10">
        <Zap className="h-[18px] w-[18px] text-volt" strokeWidth={2} />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight text-white">StepCharge AI</span>
          <span className="block text-[10px] uppercase tracking-[0.14em] text-slate-500">Energy Harvesting</span>
        </span>
      )}
    </div>
  )
}

/* --------------------------- Data source selector ------------------------ */
export function DataSourceSwitch({ compact }: { compact?: boolean }) {
  const { mode, setMode, liveAvailable, connection, packet, settings } = useStore()
  return (
    <div className={`rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 ${compact ? '' : 'space-y-3'}`}>
      <p className="label">Data source</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button
          onClick={() => setMode('live')}
          disabled={!liveAvailable}
          title={liveAvailable ? 'Use live ESP32 telemetry from Firebase' : 'Configure Firebase env vars to enable live mode'}
          className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
            mode === 'live'
              ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
              : 'border-white/10 text-slate-400 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40'
          }`}
        >
          ● LIVE ESP32
        </button>
        <button
          onClick={() => setMode('demo')}
          className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
            mode === 'demo'
              ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
              : 'border-white/10 text-slate-400 hover:bg-white/5'
          }`}
        >
          ○ DEMO
        </button>
      </div>
      <div className="mt-2.5 text-[11px]">
        {mode === 'demo' ? (
          <div className="flex items-center gap-1.5 text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span className="font-medium">DEMO MODE</span>
            <span className="text-slate-500">· Simulated telemetry</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-pulsering rounded-full bg-emerald-400" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="font-medium">LIVE</span>
            <span className="text-slate-400">{packet?.device_id ?? settings.deviceId}</span>
            <span className="text-slate-500">· {connection === 'connected' ? 'Connected' : connection}</span>
          </div>
        )}
      </div>
      {!liveAvailable && (
        <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
          Live mode needs VITE_FIREBASE_* env vars.
        </p>
      )}
    </div>
  )
}

/* -------------------------------- Sidebar -------------------------------- */
export function Sidebar({
  page,
  setPage,
  open,
  onClose,
}: {
  page: PageKey
  setPage: (p: PageKey) => void
  open: boolean
  onClose: () => void
}) {
  const { health, packet, mode, isStale } = useStore()
  const secs = Math.max(1, Math.round(health.lastDataMs / 1000))
  const online = Boolean(packet) && !isStale
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/[0.06] bg-ink-900/85 backdrop-blur-xl transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-5">
          <Logo />
          <button className="text-slate-500 lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {NAV.map(({ key, label, icon: Icon }) => {
            const active = page === key
            return (
              <button
                key={key}
                onClick={() => {
                  setPage(key)
                  onClose()
                }}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-volt/10 font-medium text-white shadow-[inset_2px_0_0_0_#22d3ee]'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${active ? 'text-volt' : 'text-slate-500 group-hover:text-slate-300'}`}
                  strokeWidth={1.8}
                />
                {label}
              </button>
            )
          })}
        </nav>

        <div className="mx-3 mb-2">
          <DataSourceSwitch />
        </div>

        <div className="m-3 mt-0 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center justify-between">
            <StatusBadge tone={online ? 'ok' : 'crit'} pulse={online}>
              ESP32 {online ? 'ONLINE' : 'OFFLINE'}
            </StatusBadge>
            <Cpu className="h-3.5 w-3.5 text-slate-600" />
          </div>
          <dl className="mt-3 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <dt className="text-slate-500">Wi-Fi</dt>
              <dd className="flex items-center gap-1 text-slate-300">
                {online ? (
                  <>
                    <Wifi className="h-3 w-3 text-emerald-400" /> Connected
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 text-rose-400" /> Offline
                  </>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">RSSI</dt>
              <dd className="font-mono text-slate-300">{packet ? `${health.rssi} dBm` : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Last sync</dt>
              <dd className="font-mono text-slate-300">{packet ? `${secs} sec ago` : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Source</dt>
              <dd className={`font-mono ${mode === 'demo' ? 'text-amber-300' : 'text-emerald-300'}`}>
                {mode === 'demo' ? 'DEMO' : 'LIVE'}
              </dd>
            </div>
          </dl>
        </div>
      </aside>
    </>
  )
}

/* -------------------------------- Topbar --------------------------------- */
export function Topbar({
  onMenu,
  onBell,
  unread,
  onSignOut,
}: {
  onMenu: () => void
  onBell: () => void
  unread: number
  onSignOut: () => void
}) {
  const { health, mode, packet, connection, connectionError, retry, isStale } = useStore()
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const online = Boolean(packet) && !isStale

  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <button className="rounded-md p-1.5 text-slate-400 hover:text-white lg:hidden" onClick={onMenu}>
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight text-white sm:text-lg">StepCharge AI</h1>
          <p className="hidden truncate text-[11px] text-slate-500 sm:block">
            Smart Footstep Energy Harvesting &amp; Monitoring System
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <button
            onClick={onSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
          {mode === 'demo' ? (
            <span
              title="All values on screen are generated, not measured."
              className="chip border-amber-400/30 bg-amber-400/10 text-amber-300"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> DEMO MODE
            </span>
          ) : (
            <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> LIVE · {packet?.device_id ?? '—'}
            </span>
          )}
          <span className="hidden md:inline-flex">
            <StatusBadge tone={online ? 'ok' : 'crit'} pulse={online}>
              ESP32 {online ? 'ONLINE' : 'OFFLINE'}
            </StatusBadge>
          </span>
          <span className="hidden items-center gap-1.5 text-[11px] text-slate-400 lg:inline-flex">
            <Signal className={`h-3.5 w-3.5 ${online ? 'text-emerald-400' : 'text-slate-600'}`} />
            {packet ? `${health.rssi} dBm` : '—'}
          </span>
          <span className="hidden text-right text-[11px] leading-tight text-slate-400 sm:block">
            <span className="block font-mono text-slate-200">{now.toLocaleTimeString()}</span>
            <span className="block">
              {now.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </span>
          <button
            onClick={onBell}
            className="relative rounded-lg border border-white/10 bg-white/[0.03] p-2 text-slate-300 transition-colors hover:border-white/20 hover:text-white"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:text-white">
            <UserRound className="h-4 w-4" />
          </button>
        </div>
      </div>

      {connection === 'error' && (
        <div className="flex flex-wrap items-center gap-3 border-t border-rose-400/20 bg-rose-400/[0.07] px-4 py-2 text-[11px] text-rose-200 sm:px-6">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{connectionError ?? 'Unable to receive live telemetry.'}</span>
          <button className="btn !py-1" onClick={retry}>
            <RefreshCw className="h-3 w-3" /> Retry connection
          </button>
        </div>
      )}
      {connection === 'connected' && isStale && (
        <div className="border-t border-amber-400/20 bg-amber-400/[0.07] px-4 py-2 text-[11px] text-amber-200 sm:px-6">
          Telemetry stalled — last packet {Math.round(health.lastDataMs / 1000)} s ago. Showing last known values.
        </div>
      )}
    </header>
  )
}

/* ------------------------------ Alert drawer ----------------------------- */
const SEV: Record<AlertSeverity, { icon: LucideIcon; cls: string }> = {
  critical: { icon: XCircle, cls: 'text-rose-400 border-rose-400/25 bg-rose-400/5' },
  warning: { icon: AlertTriangle, cls: 'text-amber-400 border-amber-400/25 bg-amber-400/5' },
  info: { icon: Info, cls: 'text-volt border-volt/25 bg-volt/5' },
  success: { icon: CheckCircle2, cls: 'text-emerald-400 border-emerald-400/25 bg-emerald-400/5' },
}
const CATEGORIES: (AlertCategory | 'ALL')[] = ['ALL', 'HARDWARE', 'NETWORK', 'ENERGY', 'AI', 'SYSTEM']

export function AlertPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { alerts, markAllRead } = useStore()
  const [sev, setSev] = useState<AlertSeverity | 'all'>('all')
  const [cat, setCat] = useState<AlertCategory | 'ALL'>('ALL')
  const list = alerts.filter((a) => (sev === 'all' || a.severity === sev) && (cat === 'ALL' || a.category === cat))
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/[0.07] bg-ink-900/95 backdrop-blur-xl transition-transform ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Alert Center</h3>
            <p className="text-[11px] text-slate-500">{alerts.length} events in this session</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={markAllRead}>
              Mark read
            </button>
            <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="space-y-2 border-b border-white/[0.06] px-5 py-3">
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'critical', 'warning', 'info', 'success'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSev(f)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                  sev === f ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-wide transition-colors ${
                  cat === c ? 'border-volt/30 bg-volt/10 text-volt' : 'border-white/10 text-slate-500 hover:text-slate-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {list.length === 0 && <p className="py-10 text-center text-xs text-slate-500">No alerts in this category.</p>}
          {list.map((a) => {
            const s = SEV[a.severity]
            const Icon = s.icon
            return (
              <article key={a.id} className={`rounded-lg border p-3.5 ${s.cls}`}>
                <div className="flex items-start gap-2.5">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="text-sm font-medium text-slate-100">{a.title}</h4>
                      <time className="shrink-0 font-mono text-[10px] text-slate-500">{fmtDateTime(a.timestamp)}</time>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-slate-400">
                        {a.category}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">{a.severity}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{a.reason}</p>
                    <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-500">Current</dt>
                        <dd className="font-mono text-slate-300">{a.currentValue}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-slate-500">Threshold</dt>
                        <dd className="font-mono text-slate-300">{a.threshold}</dd>
                      </div>
                    </dl>
                    <p className="mt-2 border-t border-white/5 pt-2 text-[11px] text-slate-400">
                      <span className="text-slate-500">Recommended: </span>
                      {a.action}
                    </p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </aside>
    </>
  )
}

/* ------------------------------ Mobile nav ------------------------------- */
export function MobileNav({ page, setPage }: { page: PageKey; setPage: (p: PageKey) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/[0.07] bg-ink-900/95 backdrop-blur-xl md:hidden">
      {MOBILE_NAV.map((k) => {
        const item = NAV.find((n) => n.key === k)!
        const Icon = item.icon
        const active = page === k
        return (
          <button
            key={k}
            onClick={() => setPage(k)}
            className={`flex flex-col items-center gap-1 py-2.5 text-[10px] ${active ? 'text-volt' : 'text-slate-500'}`}
          >
            <Icon className="h-4 w-4" strokeWidth={1.9} />
            {item.label.split(' ')[0]}
          </button>
        )
      })}
    </nav>
  )
}

/* ------------------------------- FilterBar ------------------------------- */
const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: 'custom', label: 'Custom' },
]

export function FilterBar({ right }: { right?: ReactNode }) {
  const { range, setRange, customRange, history, historyLoading, mode } = useStore()
  return (
    <div className="panel flex flex-wrap items-center gap-3 p-3">
      <div className="flex flex-wrap gap-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              range === r.key ? 'bg-volt/15 text-volt' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      {range === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customRange.from}
            onChange={(e) => setRange('custom', { ...customRange, from: e.target.value })}
            className="input w-auto py-1.5 text-xs"
          />
          <span className="text-xs text-slate-600">to</span>
          <input
            type="date"
            value={customRange.to}
            onChange={(e) => setRange('custom', { ...customRange, to: e.target.value })}
            className="input w-auto py-1.5 text-xs"
          />
        </div>
      )}
      <span className="text-[11px] text-slate-500">
        {historyLoading ? 'Loading…' : `${history.length.toLocaleString()} records in range`}
        {mode === 'demo' && ' · simulated'}
      </span>
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </div>
  )
}

/* ----------------------------- DashboardLayout --------------------------- */
export function DashboardLayout({
  page,
  setPage,
  children,
  onSignOut,
}: {
  page: PageKey
  setPage: (p: PageKey) => void
  children: ReactNode
  onSignOut: () => void
}) {
  const [navOpen, setNavOpen] = useState(false)
  const [bell, setBell] = useState(false)
  const { alerts } = useStore()
  const unread = alerts.filter((a) => !a.read).length
  return (
    <div className="min-h-screen lg:pl-64">
      <Sidebar page={page} setPage={setPage} open={navOpen} onClose={() => setNavOpen(false)} />
      <Topbar
        onMenu={() => setNavOpen(true)}
        onBell={() => setBell(true)}
        unread={unread}
        onSignOut={onSignOut}
      />
      <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-5 sm:px-6 md:pb-10">{children}</main>
      <MobileNav page={page} setPage={setPage} />
      <AlertPanel open={bell} onClose={() => setBell(false)} />
    </div>
  )
}
