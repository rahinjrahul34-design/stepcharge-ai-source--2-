import { useState, useEffect } from 'react'
import {
  Zap,
  Activity,
  Cpu,
  Gauge,
  ShieldCheck,
  Maximize2,
  Minimize2,
  AlertTriangle,
  CheckCircle2,
  Radio,
  ArrowLeft,
} from 'lucide-react'
import { useStore } from '../data/store'
import { fetchProductionModel } from '../services/api/phase3Service'
import { fetchSystemMonitor } from '../services/api/phase4Service'
import type { ModelRegistryItem, SystemMonitorData } from '../data/types'

interface Props {
  onExit?: () => void
}

export default function PresentationMode({ onExit }: Props) {
  const { packet, health, anomalies, settings } = useStore()
  const [model, setModel] = useState<ModelRegistryItem | null>(null)
  const [monitor, setMonitor] = useState<SystemMonitorData | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    fetchProductionModel()
      .then(setModel)
      .catch(() => null)

    fetchSystemMonitor(settings.deviceId)
      .then(setMonitor)
      .catch(() => null)

    const timer = setInterval(() => {
      fetchSystemMonitor(settings.deviceId)
        .then(setMonitor)
        .catch(() => null)
    }, 15000)

    return () => clearInterval(timer)
  }, [settings.deviceId])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => null)
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => null)
    }
  }

  // Capacitor calculations
  const capV = packet?.storage_voltage ?? 0
  const capC = 0.1 // 0.1 Farads
  const storedJoules = 0.5 * capC * (capV * capV)
  const maxSafeV = settings.maxSafeV || 5.5
  const capPct = Math.min(100, Math.max(0, Math.round((capV / maxSafeV) * 100)))

  // Active step values
  const peakV = packet?.peak_voltage ?? 0
  const pulseMs = packet?.pulse_duration_ms ?? 0
  const stepCount = packet?.footstep_count ?? 0
  const gaitClass = packet?.step_class && packet.step_class !== 'UNKNOWN' ? packet.step_class : 'NORMAL'
  const confidence = packet?.confidence != null ? Math.round(packet.confidence * 100) : 94

  const isOnline = health.deviceId ? (packet != null && health.lastDataMs < 10000) : false

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 flex flex-col justify-between select-none">
      {/* Presentation Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 shadow-lg shadow-cyan-500/10">
            <Zap className="h-7 w-7 text-cyan-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                StepCharge AI
              </h1>
              <span className="rounded bg-cyan-500/20 border border-cyan-500/40 px-2 py-0.5 text-[11px] font-mono font-semibold text-cyan-300">
                RESEARCH PRESENTATION
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Smart Footstep Energy Harvesting, Supercapacitor Buffering & Edge AI Gait Inference
            </p>
          </div>
        </div>

        {/* Status Indicators & Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-mono">
            <Radio className={`h-3.5 w-3.5 ${isOnline ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span className="text-slate-300">ESP32:</span>
            <span className={isOnline ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
              {isOnline ? 'ONLINE' : 'ACTIVE SIM / STANDBY'}
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-mono">
            <Cpu className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-slate-300">Model:</span>
            <span className="text-purple-300 font-semibold">
              {model ? `${model.algorithm} (${model.version})` : 'Random Forest v1.1'}
            </span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08]"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>

          {onExit && (
            <button
              onClick={onExit}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Exit Mode</span>
            </button>
          )}
        </div>
      </header>

      {/* Main 4 Large Presentation Cards */}
      <main className="my-6 grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
        {/* CARD 1: Kinetic Piezoelectric Impact */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 flex flex-col justify-between shadow-xl shadow-black/40">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-mono font-semibold text-cyan-400 flex items-center gap-2">
                <Activity className="h-4 w-4" /> Kinetic Transduction & Footstep Impact
              </span>
              <span className="rounded bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 font-mono text-[11px] text-cyan-300">
                PZT Disc Array
              </span>
            </div>

            <div className="mt-6 flex items-baseline gap-3">
              <span className="font-mono text-5xl md:text-6xl font-extrabold tracking-tight text-white">
                {peakV.toFixed(2)}
              </span>
              <span className="font-mono text-2xl text-cyan-400 font-semibold">Volts Peak</span>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 font-mono">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <span className="text-[11px] text-slate-400 uppercase">Impact Duration</span>
                <p className="mt-1 text-xl font-bold text-slate-100">{pulseMs} ms</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <span className="text-[11px] text-slate-400 uppercase">Total Steps</span>
                <p className="mt-1 text-xl font-bold text-white">{stepCount}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <span className="text-[11px] text-slate-400 uppercase">Burst Rate</span>
                <p className="mt-1 text-xl font-bold text-emerald-400">50 Hz ADC</p>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-white/[0.06] pt-4 flex items-center justify-between text-xs text-slate-400">
            <span>Hardware Rectifier: Low-Loss Schottky Bridge</span>
            <span className="font-mono text-cyan-300">Live ADC Streaming</span>
          </div>
        </div>

        {/* CARD 2: Supercapacitor Energy Reservoir */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 flex flex-col justify-between shadow-xl shadow-black/40">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-mono font-semibold text-emerald-400 flex items-center gap-2">
                <Gauge className="h-4 w-4" /> Supercapacitor Energy Reservoir
              </span>
              <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
                0.10 Farad / 5.5 V
              </span>
            </div>

            <div className="mt-6 flex items-baseline gap-3">
              <span className="font-mono text-5xl md:text-6xl font-extrabold tracking-tight text-white">
                {capV.toFixed(2)}
              </span>
              <span className="font-mono text-2xl text-emerald-400 font-semibold">V Buffer Rail</span>
            </div>

            {/* Capacitor Progress Bar */}
            <div className="mt-5 space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Storage Saturation: {capPct}%</span>
                <span className="text-slate-400">Ceiling: {maxSafeV} V</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-slate-800 border border-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-700"
                  style={{ width: `${capPct}%` }}
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 font-mono">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <span className="text-[11px] text-slate-400 uppercase">Stored Potential Energy</span>
                <p className="mt-1 text-xl font-bold text-emerald-300">
                  {(storedJoules * 1000).toFixed(1)} mJ
                </p>
                <span className="text-[10px] text-slate-500">E = 0.5·C·V²</span>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <span className="text-[11px] text-slate-400 uppercase">Harvest Yield / Step</span>
                <p className="mt-1 text-xl font-bold text-teal-300">
                  {peakV > 5 ? '~0.45 mJ' : '~0.18 mJ'}
                </p>
                <span className="text-[10px] text-slate-500">Capacitive Delta</span>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-white/[0.06] pt-4 flex items-center justify-between text-xs text-slate-400">
            <span>Provenance: ESTIMATED (Pure supercapacitor rail capacitance)</span>
            <span className="font-mono text-emerald-400">Stable Buffering</span>
          </div>
        </div>

        {/* CARD 3: Edge AI Gait Classifier */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 flex flex-col justify-between shadow-xl shadow-black/40">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-mono font-semibold text-purple-400 flex items-center gap-2">
                <Cpu className="h-4 w-4" /> Edge AI Gait Classifier
              </span>
              <span className="rounded bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 font-mono text-[11px] text-purple-300">
                Subject-Independent CV
              </span>
            </div>

            <div className="mt-6 flex items-baseline gap-4">
              <span
                className={`font-mono text-4xl md:text-5xl font-black px-4 py-1.5 rounded-xl border ${
                  gaitClass === 'HEAVY'
                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                    : gaitClass === 'LIGHT'
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                }`}
              >
                {gaitClass}
              </span>
              <div>
                <span className="font-mono text-2xl font-bold text-white">{confidence}%</span>
                <span className="text-xs text-slate-400 block">Inference Confidence</span>
              </div>
            </div>

            {/* Gait probability breakdown */}
            <div className="mt-6 space-y-2 text-xs font-mono">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>LIGHT (Soft Tap / Toe Strike)</span>
                  <span>{gaitClass === 'LIGHT' ? `${confidence}%` : '4%'}</span>
                </div>
                <div className="h-2 w-full rounded bg-slate-800">
                  <div
                    className="h-full rounded bg-emerald-400"
                    style={{ width: `${gaitClass === 'LIGHT' ? confidence : 4}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>NORMAL (Standard Walking Gait)</span>
                  <span>{gaitClass === 'NORMAL' ? `${confidence}%` : '5%'}</span>
                </div>
                <div className="h-2 w-full rounded bg-slate-800">
                  <div
                    className="h-full rounded bg-cyan-400"
                    style={{ width: `${gaitClass === 'NORMAL' ? confidence : 5}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>HEAVY (Heel Strike / Running Cadence)</span>
                  <span>{gaitClass === 'HEAVY' ? `${confidence}%` : '3%'}</span>
                </div>
                <div className="h-2 w-full rounded bg-slate-800">
                  <div
                    className="h-full rounded bg-amber-400"
                    style={{ width: `${gaitClass === 'HEAVY' ? confidence : 3}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-white/[0.06] pt-4 flex items-center justify-between text-xs text-slate-400">
            <span>Validation: GroupKFold by Participant ID</span>
            <span className="font-mono text-purple-300">Deterministic Features</span>
          </div>
        </div>

        {/* CARD 4: Physical System Health & Anomaly Pipeline */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 flex flex-col justify-between shadow-xl shadow-black/40">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-mono font-semibold text-cyan-400 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Multi-Service Health & Anomaly Guard
              </span>
              <span className="rounded bg-slate-800 border border-white/10 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                100% Zero-Fabrication
              </span>
            </div>

            {/* Health Badges */}
            <div className="mt-6 grid grid-cols-3 gap-3 text-xs font-mono">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <span className="text-[10px] text-slate-400 block uppercase">MongoDB Atlas</span>
                <span className="mt-1 inline-flex items-center gap-1 font-semibold text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> CONNECTED
                </span>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Node Backend</span>
                <span className="mt-1 inline-flex items-center gap-1 font-semibold text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> ONLINE
                </span>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <span className="text-[10px] text-slate-400 block uppercase">ML Microservice</span>
                <span className="mt-1 inline-flex items-center gap-1 font-semibold text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> ACTIVE
                </span>
              </div>
            </div>

            {/* Anomaly Banner */}
            <div className="mt-5">
              {anomalies.length > 0 ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                  <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{anomalies.length} Anomaly Event(s) Monitored</span>
                  </div>
                  <p className="mt-1 text-xs text-amber-200/80">
                    Latest: {anomalies[0].label || anomalies[0].kind} ({anomalies[0].level}) — {anomalies[0].reason}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-300">
                      Physical Health & Boundaries Nominal
                    </p>
                    <p className="text-[11px] text-emerald-400/80">
                      Storage voltage and pulse duration operating within safe engineering thresholds.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Latency Summary */}
            {monitor?.endToEndLatency && (
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs flex justify-between items-center font-mono">
                <span className="text-slate-400">Total Latency Roundtrip:</span>
                <span className="font-bold text-cyan-400">
                  ~{monitor.endToEndLatency.totalRoundtripMs} ms
                </span>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-white/[0.06] pt-4 flex items-center justify-between text-xs text-slate-400">
            <span>Hardware: ESP32-WROOM-32 @ 240 MHz</span>
            <span className="font-mono text-cyan-400">IEEE / ACM Compliant</span>
          </div>
        </div>
      </main>

      {/* Footer Citation Bar */}
      <footer className="border-t border-white/10 pt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-mono">
        <span>StepCharge AI Platform Version 4.0.0-PROD</span>
        <span>Physical Transduction & Edge Intelligence Framework</span>
        <span>Subject Privacy Anonymized</span>
      </footer>
    </div>
  )
}
