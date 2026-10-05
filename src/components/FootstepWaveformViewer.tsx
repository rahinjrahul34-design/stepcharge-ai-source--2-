import { useEffect, useState, useMemo } from 'react'
import { Activity, RefreshCw, Zap, Clock, ShieldCheck, Footprints } from 'lucide-react'
import { Panel, StatusBadge } from './ui'
import { fetchLatestWaveform } from '../services/api/phase2Service'
import { useStore } from '../data/store'

interface WaveformData {
  waveform: number[]
  samplingRate: number
  peakVoltage: number
  averageVoltage: number
  pulseDuration: number
  timestamp: string
  stepClass: string
}

export function FootstepWaveformViewer({ deviceId }: { deviceId?: string }) {
  const { mode, lastEvent } = useStore()
  const [data, setData] = useState<WaveformData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadLatest = async () => {
    if (mode === 'demo') {
      // Demo simulated waveform (strictly inside demo mode)
      const demoSamples = [
        0.05, 0.12, 0.28, 0.65, 1.42, 2.85, 3.75, 4.20, 3.85, 2.90,
        1.85, 1.15, 0.72, 0.45, 0.30, 0.22, 0.15, 0.10, 0.08, 0.05
      ]
      setData({
        waveform: demoSamples,
        samplingRate: 50,
        peakVoltage: 4.20,
        averageVoltage: 1.25,
        pulseDuration: 400,
        timestamp: new Date().toISOString(),
        stepClass: 'NORMAL',
      })
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetchLatestWaveform(deviceId)
      setData(res)
    } catch {
      setError('Unable to fetch latest waveform from hardware.')
    } finally {
      setLoading(false)
    }
  }

  // Reload when a new footstep event arrives
  useEffect(() => {
    if (lastEvent?.waveform && lastEvent.waveform.length > 0) {
      setData({
        waveform: lastEvent.waveform,
        samplingRate: lastEvent.sampling_rate || 50,
        peakVoltage: lastEvent.peak_voltage,
        averageVoltage: lastEvent.features.averageVoltage,
        pulseDuration: lastEvent.pulse_duration_ms,
        timestamp: lastEvent.timestamp,
        stepClass: lastEvent.step_class,
      })
    } else {
      void loadLatest()
    }
  }, [lastEvent])

  // SVG Coordinates calculation
  const svgPath = useMemo(() => {
    if (!data || !data.waveform || data.waveform.length === 0) return { path: '', area: '', points: [] }
    const samples = data.waveform
    const maxV = Math.max(5.0, ...samples) * 1.15
    const width = 600
    const height = 180

    const pts = samples.map((v, i) => {
      const x = (i / (samples.length - 1 || 1)) * width
      const y = height - (Math.max(0, v) / maxV) * height
      return { x, y, v, timeMs: Math.round(i * (1000 / (data.samplingRate || 50))) }
    })

    const pathD = pts.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '')
    const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`

    return { path: pathD, area: areaD, points: pts, maxV, width, height }
  }, [data])

  return (
    <Panel
      title="Footstep Signal Waveform"
      subtitle="Calibrated analog signal capture from piezoelectric harvester (Voltage vs Time)"
      icon={Activity}
      actions={
        <div className="flex items-center gap-2">
          {mode === 'demo' ? (
            <StatusBadge tone="warn">DEMO SIMULATION</StatusBadge>
          ) : data?.waveform && data.waveform.length > 0 ? (
            <StatusBadge tone="ok">REAL WAVEFORM</StatusBadge>
          ) : (
            <StatusBadge tone="idle">WAITING FOR IMPULSE</StatusBadge>
          )}
          <button
            className="btn btn-secondary text-xs py-1 px-2.5"
            onClick={() => void loadLatest()}
            disabled={loading}
            title="Reload latest captured waveform"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">
          {error}
        </div>
      )}

      {data?.waveform && data.waveform.length > 0 ? (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-lg border border-white/[0.08] bg-ink-950/80 p-4">
            <svg
              viewBox={`0 0 ${svgPath.width || 600} ${svgPath.height || 180}`}
              className="w-full h-44 overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="waveformGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              <line x1="0" y1="45" x2="600" y2="45" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="0" y1="90" x2="600" y2="90" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="0" y1="135" x2="600" y2="135" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

              {/* Filled Area */}
              <path d={svgPath.area} fill="url(#waveformGradient)" />

              {/* Waveform Line */}
              <path d={svgPath.path} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />

              {/* Sample points */}
              {svgPath.points.map((p, idx) => (
                <circle
                  key={idx}
                  cx={p.x}
                  cy={p.y}
                  r="2.5"
                  className="fill-sky-400 hover:r-4 transition-all"
                >
                  <title>{`${p.timeMs}ms: ${p.v.toFixed(2)}V`}</title>
                </circle>
              ))}
            </svg>

            {/* Axis labels */}
            <div className="mt-2 flex justify-between text-[10px] font-mono text-slate-500">
              <span>0 ms (Rising Edge)</span>
              <span>{Math.round(((data.waveform.length - 1) * 1000) / (data.samplingRate || 50))} ms (Settled)</span>
            </div>
          </div>

          {/* Signal Diagnostics Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <span className="label flex items-center gap-1.5"><Zap className="h-3 w-3 text-sky-400" /> Peak Voltage</span>
              <p className="mt-1 font-mono text-base font-semibold text-white">{data.peakVoltage.toFixed(2)} V</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <span className="label flex items-center gap-1.5"><Clock className="h-3 w-3 text-amber-400" /> Pulse Duration</span>
              <p className="mt-1 font-mono text-base font-semibold text-white">{data.pulseDuration} ms</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <span className="label flex items-center gap-1.5"><Footprints className="h-3 w-3 text-emerald-400" /> Classification</span>
              <p className="mt-1 font-mono text-base font-semibold text-emerald-300">{data.stepClass}</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <span className="label flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-purple-400" /> Sample Density</span>
              <p className="mt-1 font-mono text-base font-semibold text-white">{data.waveform.length} pts @ {data.samplingRate}Hz</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid place-items-center py-12 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.01]">
          <Activity className="h-8 w-8 text-slate-600 mb-2" />
          <p className="text-sm font-medium text-slate-300">NO WAVEFORM DATA AVAILABLE</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">
            {mode === 'demo'
              ? 'Click Simulate Footstep to test the waveform viewer.'
              : 'Waiting for physical footstep impact on the piezoelectric mat to stream high-speed ADC envelope samples.'}
          </p>
        </div>
      )}
    </Panel>
  )
}
