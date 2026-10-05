import { useState } from 'react'
import {
  BatteryCharging,
  BrainCircuit,
  Cloud,
  Cpu,
  Footprints,
  LayoutDashboard,
  Layers,
  Waves,
  Wifi,
  type LucideIcon,
} from 'lucide-react'
import { useStore } from '../data/store'
import { Panel, StatusBadge } from './ui'
import hardwareImg from '../assets/visual-hardware.jpg'

type NodeTone = 'ok' | 'warn' | 'crit' | 'idle'

interface ArchNode {
  key: string
  label: string
  icon: LucideIcon
  purpose: string
  input: string
  output: string
  status: string
  tone: NodeTone
}

/**
 * Interactive end-to-end system architecture. Node status is derived only
 * from real store state — passive hardware stages we cannot observe are
 * reported as "not instrumented" rather than assumed healthy.
 */
export function SystemArchitecture() {
  const { health, mode, mlKind, mlHealth, packet, isStale } = useStore()
  const live = Boolean(packet) && !isStale
  const passive = (observed: boolean): [string, NodeTone] =>
    observed ? ['INFERRED FROM TELEMETRY', 'ok'] : ['NOT INSTRUMENTED', 'idle']

  const nodes: ArchNode[] = [
    { key: 'step', label: 'Human footstep', icon: Footprints, purpose: 'Mechanical load applied to the tile.', input: 'Body weight / gait', output: 'Pressure on the mat', status: live ? 'STEPS DETECTED' : 'NO RECENT STEPS', tone: live ? 'ok' : 'idle' },
    { key: 'piezo', label: 'Piezo mat', icon: Layers, purpose: 'Converts mechanical strain into AC voltage.', input: 'Pressure', output: 'AC voltage pulse', status: passive(live)[0], tone: passive(live)[1] },
    { key: 'rect', label: 'Rectifier', icon: Waves, purpose: 'Bridge rectifier turns AC pulses into DC.', input: 'AC pulse', output: 'Pulsating DC', status: passive(live)[0], tone: passive(live)[1] },
    { key: 'cap', label: 'Supercapacitor', icon: BatteryCharging, purpose: 'Stores harvested charge (E = ½CV², estimated).', input: 'DC charge', output: 'Storage voltage', status: packet ? `${packet.storage_voltage.toFixed(2)} V MEASURED` : 'NO READING', tone: packet ? 'ok' : 'idle' },
    { key: 'esp', label: 'ESP32', icon: Cpu, purpose: 'Samples voltages, detects steps, controls the load.', input: 'ADC voltages', output: 'Telemetry packets', status: health.esp32.toUpperCase(), tone: health.esp32 === 'online' ? 'ok' : health.esp32 === 'degraded' ? 'warn' : 'crit' },
    { key: 'wifi', label: 'Wi-Fi', icon: Wifi, purpose: 'Transports telemetry to the cloud.', input: 'Packets', output: 'HTTPS stream', status: packet ? `${health.wifi.toUpperCase()} · ${health.rssi} dBm` : 'UNKNOWN', tone: packet ? 'ok' : 'idle' },
    { key: 'fb', label: 'Firebase', icon: Cloud, purpose: 'Realtime store for telemetry, history and alerts.', input: 'Telemetry', output: 'Realtime subscription', status: mode === 'demo' ? 'NOT USED (DEMO)' : health.cloud.toUpperCase(), tone: mode === 'demo' ? 'idle' : health.cloud === 'connected' ? 'ok' : 'crit' },
    { key: 'ml', label: 'ML service', icon: BrainCircuit, purpose: 'Random Forest classifies LIGHT / NORMAL / HEAVY.', input: '5 step features', output: 'Class + confidence', status: mlKind !== 'api' ? 'NOT CONFIGURED' : !mlHealth ? 'CHECKING…' : !mlHealth.reachable ? 'OFFLINE' : mlHealth.modelLoaded ? 'MODEL LOADED' : 'MODEL NOT TRAINED', tone: mlKind !== 'api' ? 'idle' : mlHealth?.reachable ? (mlHealth.modelLoaded ? 'ok' : 'warn') : 'crit' },
    { key: 'ui', label: 'Dashboard', icon: LayoutDashboard, purpose: 'Visualises data with clear provenance.', input: 'Telemetry + predictions', output: 'Insight', status: mode === 'demo' ? 'DEMO MODE' : 'LIVE MODE', tone: mode === 'demo' ? 'warn' : 'ok' },
  ]

  const [sel, setSel] = useState('esp')
  const active = nodes.find((n) => n.key === sel) ?? nodes[0]
  const dot = { ok: 'bg-emerald-400', warn: 'bg-amber-400', crit: 'bg-rose-400', idle: 'bg-slate-600' }

  return (
    <Panel title="System Architecture" subtitle="Footstep → energy → storage → AI → insight. Select a stage for details.">
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <div className="-mx-1 flex items-stretch gap-0 overflow-x-auto px-1 pb-2" role="list">
            {nodes.map((n, i) => (
              <div key={n.key} className="flex items-center" role="listitem">
                <button className="arch-node" aria-pressed={n.key === sel} onClick={() => setSel(n.key)}>
                  <span className="flex items-center gap-1.5">
                    <n.icon className="h-3.5 w-3.5 text-volt" strokeWidth={1.8} />
                    <span className={`h-1.5 w-1.5 rounded-full ${dot[n.tone]}`} aria-hidden />
                  </span>
                  <span className="text-xs font-medium text-slate-200">{n.label}</span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{n.status}</span>
                </button>
                {i < nodes.length - 1 && <span className="arch-link" aria-hidden />}
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 sm:grid-cols-4">
            <div className="sm:col-span-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{active.label}</p>
              <StatusBadge tone={active.tone}>{active.status}</StatusBadge>
            </div>
            <div className="sm:col-span-2">
              <span className="label">Purpose</span>
              <p className="mt-1 text-xs text-slate-300">{active.purpose}</p>
            </div>
            <div>
              <span className="label">Input</span>
              <p className="mt-1 text-xs text-slate-300">{active.input}</p>
            </div>
            <div>
              <span className="label">Output</span>
              <p className="mt-1 text-xs text-slate-300">{active.output}</p>
            </div>
          </div>
        </div>
        <img
          src={hardwareImg}
          alt="Piezo disc, rectifier, supercapacitor, ESP32, sensing resistors and load relay"
          width={1400}
          height={560}
          loading="lazy"
          decoding="async"
          className="hidden h-full max-h-56 w-full rounded-lg border border-white/[0.06] object-cover opacity-80 xl:col-span-4 xl:block"
        />
      </div>
    </Panel>
  )
}
