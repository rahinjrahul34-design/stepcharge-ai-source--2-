import { useEffect, useRef, useState, type ReactNode } from 'react'
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
  PanelLeftClose,
  PanelLeftOpen,
  Sliders,
  Microscope,
  Layers,
  Tv,
  Check,
  CheckCheck,
  ShieldCheck,
} from 'lucide-react'
import { useStore } from '../data/store'
import { StatusBadge, fmtDateTime } from './ui'
import type { AlertCategory, AlertSeverity, RangeKey } from '../data/types'
import type { AuthUser } from '../services/api/authService'

export type PageKey =
  | 'overview'
  | 'live'
  | 'footsteps'
  | 'energy'
  | 'experiments'
  | 'calibration'
  | 'ai'
  | 'model'
  | 'research'
  | 'history'
  | 'health'
  | 'settings'
  | 'presentation'

export const NAV: { key: PageKey; label: string; icon: LucideIcon }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'live', label: 'Live Monitoring', icon: Activity },
  { key: 'footsteps', label: 'Footstep Analytics', icon: Footprints },
  { key: 'energy', label: 'Energy Analytics', icon: Zap },
  { key: 'experiments', label: 'Experiment Mode', icon: Microscope },
  { key: 'calibration', label: 'Hardware Calibration', icon: Sliders },
  { key: 'ai', label: 'AI Insights', icon: BrainCircuit },
  { key: 'model', label: 'AI Model', icon: FlaskConical },
  { key: 'research', label: 'Research Analytics', icon: Layers },
  { key: 'presentation', label: 'Presentation Mode', icon: Tv },
  { key: 'history', label: 'History', icon: Database },
  { key: 'health', label: 'System Health', icon: Gauge },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
]

const MOBILE_NAV: PageKey[] = ['overview', 'live', 'footsteps', 'experiments', 'ai', 'health']

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center rounded-lg border border-volt/25 bg-volt/10">
        <Zap className="h-[18px] w-[18px] text-volt" strokeWidth={2} />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-sm font-semibold tracking-tight text-white">StepCharge AI</span>
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
          title={liveAvailable ? 'Use live ESP32 telemetry from Node.js backend & MongoDB' : 'Backend API connection required'}
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
    </div>
  )
}

/* -------------------------------- Sidebar -------------------------------- */
export function Sidebar({
  page,
  setPage,
  open,
  onClose,
  collapsed = false,
  onToggleCollapsed,
}: {
  page: PageKey
  setPage: (p: PageKey) => void
  open: boolean
  onClose: () => void
  collapsed?: boolean
  onToggleCollapsed?: () => void
}) {
  const { health, packet, mode, isStale } = useStore()
  const secs = Math.max(1, Math.round(health.lastDataMs / 1000))
  const online = Boolean(packet) && !isStale
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col ${collapsed ? 'lg:w-20' : ''} border-r border-white/[0.06] bg-ink-900/85 backdrop-blur-xl transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-5">
          <Logo compact={collapsed} />
          {onToggleCollapsed && (
            <button
              className="hidden rounded-md p-1 text-slate-500 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/60 lg:inline-flex"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          )}
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
                <span className={collapsed ? 'lg:sr-only' : ''}>{label}</span>
              </button>
            )
          })}
        </nav>

        <div className={`mx-3 mb-2 ${collapsed ? 'lg:hidden' : ''}`}>
          <DataSourceSwitch />
        </div>

        <div className={`m-3 mt-0 rounded-lg ${collapsed ? 'lg:hidden' : ''} border border-white/[0.06] bg-white/[0.02] p-3`}>
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
  user,
  onPresentation,
}: {
  onMenu: () => void
  onBell: () => void
  unread: number
  onSignOut: () => void
  user?: AuthUser | null
  onPresentation?: () => void
}) {
  const { health, mode, packet, connection, connectionError, retry, isStale } = useStore()
  const [now, setNow] = useState(new Date())
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (!profileOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [profileOpen])
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
          {onPresentation && (
            <button
              onClick={onPresentation}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors shadow-sm"
              title="Switch to full-screen research presentation mode"
            >
              <Tv className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Presentation</span>
            </button>
          )}
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
          {/* User Profile Button & Floating Menu */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              aria-label="Open profile menu"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((open) => !open)}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/70 ${
                profileOpen
                  ? 'border-volt/60 bg-volt/10 ring-2 ring-volt/40 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                  : 'border-white/10 bg-white/[0.03] hover:border-volt/40 hover:bg-volt/[0.08] hover:shadow-[0_0_15px_rgba(34,211,238,0.18)]'
              }`}
              title="User profile and account settings"
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || 'User avatar'}
                  className="h-6 w-6 rounded-full object-cover border border-volt/30"
                />
              ) : (
                <div className="grid h-6 w-6 place-items-center rounded-full bg-volt/20 text-[10px] font-bold text-volt ring-1 ring-volt/30">
                  {((user?.name || user?.email || (mode === 'demo' ? 'Demo' : 'User')).charAt(0)).toUpperCase()}
                </div>
              )}
              <div className="hidden text-left sm:block">
                <span className="block max-w-[110px] truncate text-[11px] font-medium leading-none text-slate-200">
                  {user?.name || user?.email?.split('@')[0] || (mode === 'demo' ? 'Demo User' : 'Active Session')}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-volt/80 font-semibold">
                  {user?.role || (mode === 'demo' ? 'DEMO' : 'USER')}
                </span>
              </div>
            </button>

            {/* Profile Floating Panel */}
            {profileOpen && (
              <div
                role="menu"
                aria-label="Profile and account menu"
                className="absolute right-0 top-[calc(100%+10px)] z-50 w-72 sm:w-80 max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-white/10 bg-ink-900/95 shadow-2xl shadow-black/60 backdrop-blur-xl transition-all duration-200 animate-in fade-in zoom-in-95"
              >
                {/* Header / Profile Info */}
                <div className="border-b border-white/[0.08] bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Profile</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-volt/30 bg-volt/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-volt">
                      {user?.role || (mode === 'demo' ? 'DEMO USER' : 'USER')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt=""
                        className="h-11 w-11 rounded-full border border-volt/30 object-cover shadow-sm"
                      />
                    ) : (
                      <div className="grid h-11 w-11 place-items-center rounded-full bg-volt/20 text-base font-bold text-volt ring-1 ring-volt/30 shadow-inner">
                        {((user?.name || user?.email || (mode === 'demo' ? 'Demo' : 'User')).charAt(0)).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {user?.name || (mode === 'demo' ? 'Demo Researcher' : 'StepCharge User')}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {user?.email || (mode === 'demo' ? 'demo@stepcharge.local' : 'Session authenticated')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Account / Security / Preferences links */}
                <div className="space-y-1 p-2 text-xs text-slate-400">
                  <div className="flex items-start gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]">
                    <UserRound className="mt-0.5 h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <div>
                      <span className="block font-medium text-slate-200">Account</span>
                      <span className="text-[11px] text-slate-500">
                        {user?.uid ? `ID: ${user.uid.slice(0, 14)}…` : 'StepCharge Energy Platform'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <div>
                      <span className="block font-medium text-slate-200">Security</span>
                      <span className="text-[11px] text-slate-500">HTTP-only session &amp; RBAC active</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]">
                    <Sliders className="mt-0.5 h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    <div>
                      <span className="block font-medium text-slate-200">Preferences</span>
                      <span className="text-[11px] text-slate-500">Customizable in Settings panel</span>
                    </div>
                  </div>
                </div>

                {/* Sign Out Action */}
                <div className="border-t border-white/[0.08] p-2 bg-white/[0.01]">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false)
                      onSignOut()
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-500/10 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
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

function fmtRelativeTime(isoString: string): string {
  try {
    const diff = Math.max(0, Date.now() - new Date(isoString).getTime())
    const sec = Math.floor(diff / 1000)
    if (sec < 45) return 'Just now'
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h ago`
    const days = Math.floor(hr / 24)
    if (days < 7) return `${days}d ago`
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch {
    return 'Recently'
  }
}

export function AlertPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { alerts, markAlertRead, markAllRead } = useStore()
  const [sev, setSev] = useState<AlertSeverity | 'all'>('all')
  const [cat, setCat] = useState<AlertCategory | 'ALL'>('ALL')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const list = alerts.filter((a) => (sev === 'all' || a.severity === sev) && (cat === 'ALL' || a.category === cat))
  const unreadCount = alerts.filter((a) => !a.read).length

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity" onClick={onClose} />}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Notifications Center"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/[0.08] bg-ink-900/95 backdrop-blur-xl shadow-2xl transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 bg-white/[0.02]">
          <div>
            <h3 className="text-sm font-bold text-white">Notifications</h3>
            <p className="text-[11px] text-slate-400">
              <span className={unreadCount > 0 ? 'text-volt font-semibold' : 'text-slate-500'}>
                {unreadCount} unread
              </span>{' '}
              · {alerts.length} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost text-xs px-2.5 py-1.5 text-volt hover:bg-volt/10 hover:text-cyan-300 disabled:opacity-40"
              disabled={busyId === 'all' || unreadCount === 0}
              onClick={() => {
                setError(null)
                setBusyId('all')
                void markAllRead()
                  .catch(() => setError("Couldn't update notifications. Please try again."))
                  .finally(() => setBusyId(null))
              }}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>{busyId === 'all' ? 'Updating…' : 'Mark all as read'}</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close notifications"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="space-y-2 border-b border-white/[0.06] px-5 py-3 bg-white/[0.01]">
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'critical', 'warning', 'info', 'success'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSev(f)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                  sev === f ? 'bg-volt/20 text-volt border border-volt/30' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
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
                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide transition-colors ${
                  cat === c ? 'border-volt/40 bg-volt/10 text-volt' : 'border-white/10 text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {error && (
            <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/[0.08] p-3 text-xs text-rose-200">
              <p>{error}</p>
            </div>
          )}

          {/* Premium Empty State */}
          {list.length === 0 && (
            <div className="py-20 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-6 w-6" strokeWidth={1.8} />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-100">You're all caught up</p>
              <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                New system events, threshold triggers, and energy alerts will appear here.
              </p>
            </div>
          )}

          {/* Notification Cards */}
          {list.map((a) => {
            const s = SEV[a.severity]
            const Icon = s.icon
            const isUnread = !a.read

            return (
              <article
                key={a.id}
                className={`group rounded-xl border p-4 transition-all duration-200 ${
                  isUnread
                    ? 'border-volt/30 bg-volt/[0.03] shadow-[0_0_12px_rgba(34,211,238,0.06)]'
                    : 'border-white/[0.06] bg-white/[0.015] opacity-75 hover:opacity-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-lg border p-1.5 ${s.cls}`}>
                    <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-volt ring-2 ring-volt/20 shrink-0" />}
                        <h4 className="text-xs font-semibold text-slate-100 leading-snug">{a.title}</h4>
                      </div>
                      <time
                        title={fmtDateTime(a.timestamp)}
                        className="shrink-0 font-mono text-[10px] text-slate-400"
                      >
                        {fmtRelativeTime(a.timestamp)}
                      </time>
                    </div>

                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-slate-400">
                        {a.category}
                      </span>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500">{a.severity}</span>
                    </div>

                    <p className="mt-2 text-xs leading-relaxed text-slate-300/90">{a.reason}</p>

                    {(a.currentValue || a.threshold) && (
                      <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-white/[0.04] bg-white/[0.02] p-2 text-[11px]">
                        {a.currentValue && (
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-500">Current</dt>
                            <dd className="font-mono text-slate-300 font-medium">{a.currentValue}</dd>
                          </div>
                        )}
                        {a.threshold && (
                          <div className="flex justify-between gap-2">
                            <dt className="text-slate-500">Threshold</dt>
                            <dd className="font-mono text-slate-300 font-medium">{a.threshold}</dd>
                          </div>
                        )}
                      </dl>
                    )}

                    {a.action && (
                      <p className="mt-2.5 text-[11px] text-slate-400 leading-relaxed border-t border-white/5 pt-2">
                        <span className="text-slate-500 font-medium">Recommended: </span>
                        {a.action}
                      </p>
                    )}

                    {/* Mark as read button */}
                    {isUnread && (
                      <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-end">
                        <button
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => {
                            setError(null)
                            setBusyId(a.id)
                            void markAlertRead(a.id)
                              .catch(() => setError("Couldn't update notification. Please try again."))
                              .finally(() => setBusyId(null))
                          }}
                          className="group/btn inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition-all hover:border-volt/40 hover:bg-volt/10 hover:text-volt disabled:opacity-50"
                        >
                          <Check className="h-3 w-3 transition-transform group-hover/btn:scale-110" />
                          <span>{busyId === a.id ? 'Updating…' : 'Mark as read'}</span>
                        </button>
                      </div>
                    )}
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
  user,
}: {
  page: PageKey
  setPage: (p: PageKey) => void
  children: ReactNode
  onSignOut: () => void
  user?: AuthUser | null
}) {
  const [navOpen, setNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sc.sidebar') === 'collapsed')
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      localStorage.setItem('sc.sidebar', c ? 'expanded' : 'collapsed')
      return !c
    })
  const [bell, setBell] = useState(false)
  const { alerts } = useStore()
  const unread = alerts.filter((a) => !a.read).length
  return (
    <div className={`min-h-screen transition-[padding] ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
      <Sidebar
        page={page}
        setPage={setPage}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />
      <Topbar
        onMenu={() => setNavOpen(true)}
        onBell={() => setBell(true)}
        unread={unread}
        onSignOut={onSignOut}
        user={user}
        onPresentation={() => setPage('presentation')}
      />
      <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-5 sm:px-6 md:pb-10">{children}</main>
      <MobileNav page={page} setPage={setPage} />
      <AlertPanel open={bell} onClose={() => setBell(false)} />
    </div>
  )
}
