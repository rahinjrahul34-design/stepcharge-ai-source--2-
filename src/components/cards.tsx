import { useEffect, useMemo, useState } from 'react'
import {
  BatteryCharging,
  BrainCircuit,
  CircleHelp,
  Fan,
  Footprints,
  Gauge,
  Lightbulb,
  Radio,
  ShieldAlert,
  Sparkles,
  Zap,
  CircuitBoard,
  ArrowDown,
  Activity,
} from 'lucide-react'
import { useStore } from '../data/store'
import { estPowerMw, storedEnergyJ } from '../data/energy'
import {
  AnimatedNumber,
  ConfidenceBar,
  EmptyState,
  Panel,
  PredictionTag,
  ProvenanceTag,
  StatusBadge,
  Toggle,
  classTone,
  fmtTime,
} from './ui'
import type { AiInsight, Anomaly, Prediction, StepClass, StepFeatures } from '../data/types'

const FEATURE_LABEL: Record<keyof StepFeatures, string> = {
  peakVoltage: 'Peak Voltage',
  averageVoltage: 'Average Voltage',
  pulseDuration: 'Pulse Duration',
  stepInterval: 'Step Interval',
  storageVoltage: 'Storage Voltage',
}
const featureValue = (k: keyof StepFeatures, f: StepFeatures) =>
  k === 'pulseDuration'
    ? `${f.pulseDuration} ms`
    : k === 'stepInterval'
      ? `${f.stepInterval.toFixed(2)} s`
      : `${(f[k] as number).toFixed(2)} V`

/* --------------------------- FOOTSTEP DETECTED --------------------------- */
export function FootstepDetectedCard() {
  const { lastEvent } = useStore()
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (!lastEvent) return
    setFlash(true)
    const id = setTimeout(() => setFlash(false), 900)
    return () => clearTimeout(id)
  }, [lastEvent])

  if (!lastEvent)
    return (
      <Panel title="Footstep Detection" icon={Footprints}>
        <EmptyState title="Awaiting first footstep." message="The event card populates the moment a step is detected." />
      </Panel>
    )

  const f = lastEvent.features
  const rows: [string, string][] = [
    ['Time', fmtTime(lastEvent.timestamp)],
    ['Peak Voltage', `${f.peakVoltage.toFixed(2)} V`],
    ['Average Voltage', `${f.averageVoltage.toFixed(2)} V`],
    ['Pulse Duration', `${f.pulseDuration} ms`],
    ['Step Interval', `${f.stepInterval.toFixed(2)} s`],
    ['Estimated Energy', `${(lastEvent.estimated_energy_j * 1000).toFixed(2)} mJ`],
  ]

  return (
    <Panel
      title="Footstep Detected"
      icon={Footprints}
      className={`transition-shadow duration-500 ${flash ? 'ring-1 ring-volt/50' : ''}`}
      actions={<StatusBadge tone="info" pulse>LIVE EVENT</StatusBadge>}
    >
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <dt className="text-[10px] uppercase tracking-wider text-slate-500">{k}</dt>
            <dd className="mt-0.5 font-mono text-sm text-slate-100">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
        <div>
          <span className="label">Classification</span>
          <p className="mt-0.5 font-mono text-lg font-semibold text-white">
            {lastEvent.step_class === 'UNKNOWN' ? 'UNCLASSIFIED' : lastEvent.step_class}
          </p>
        </div>
        <div>
          <span className="label">Confidence</span>
          <p className="mt-0.5 font-mono text-lg font-semibold text-emerald-400">
            {fmtConfidence(lastEvent.confidence)}
          </p>
        </div>
        <div className="ml-auto">
          <PredictionTag source={lastEvent.prediction_source} />
        </div>
      </div>
    </Panel>
  )
}

/** Confidence is only shown when a real classifier produced it. */
export const fmtConfidence = (c: number | null) => (c === null ? '—' : `${(c * 100).toFixed(0)}%`)

/* ------------------------- AI Classification card ------------------------ */
export function AIClassificationCard({ compact }: { compact?: boolean }) {
  const { packet, lastEvent, settings, explain, model } = useStore()
  const [pred, setPred] = useState<Prediction | null>(null)

  useEffect(() => {
    let alive = true
    if (!lastEvent) return
    explain(lastEvent)
      .then((p) => alive && setPred(p))
      .catch(() => alive && setPred(null))
    return () => {
      alive = false
    }
  }, [lastEvent, explain])

  const features = lastEvent?.features
  const reasons = useMemo(() => {
    if (!features || !packet) return []
    const cls = pred?.class ?? packet.step_class
    if (cls === 'UNKNOWN') return []
    const band = { LIGHT: '1.1–2.3 V', NORMAL: '2.6–4.1 V', HEAVY: '4.2–5.4 V' }[cls]
    return [
      `Peak voltage of ${features.peakVoltage.toFixed(2)} V falls inside the ${cls.toLowerCase()} reference band (${band}).`,
      `Pulse duration of ${features.pulseDuration} ms matched the ${cls.toLowerCase()} profile.`,
      `Step interval of ${features.stepInterval.toFixed(2)} s is ${
        features.stepInterval > 2.2 ? 'relaxed' : features.stepInterval < 1.2 ? 'brisk' : 'moderate'
      }, consistent with the predicted class.`,
      model.connected
        ? 'Feature contributions below come from the trained model.'
        : 'Contributions below are heuristic distances, not trained feature importances.',
    ]
  }, [features, pred, packet, model.connected])

  if (!packet)
    return (
      <Panel title="AI Footstep Classification" icon={BrainCircuit}>
        <EmptyState title="No prediction yet" message="Waiting for the first footstep event from the device." />
      </Panel>
    )

  const shownClass = pred?.class ?? packet.step_class
  const shownConfidence = pred?.confidence ?? packet.confidence
  const low = shownConfidence !== null && shownConfidence < settings.confidenceThreshold
  const order: StepClass[] = ['LIGHT', 'NORMAL', 'HEAVY']
  const probs = pred?.probabilities ?? packet.probabilities
  const contributions = pred?.contributions


  return (
    <Panel
      title="AI Footstep Classification"
      subtitle={`${model.connected ? model.modelName : 'No trained model connected'} · 5-feature vector`}
      icon={BrainCircuit}
      actions={<PredictionTag source={pred?.source ?? packet.prediction_source} />}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="label">Current prediction</span>
          <p className="mt-1 font-mono text-4xl font-semibold tracking-tight text-white">
            {shownClass === 'UNKNOWN' ? 'UNCLASSIFIED' : shownClass}
          </p>
        </div>
        <div className="text-right">
          <span className="label">Model confidence</span>
          {shownConfidence === null ? (
            <p className="mt-1 font-mono text-xl font-semibold text-slate-400">Not available</p>
          ) : (
            <p className={`mt-1 font-mono text-3xl font-semibold ${low ? 'text-amber-400' : 'text-emerald-400'}`}>
              <AnimatedNumber value={shownConfidence * 100} decimals={0} />%
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {probs === null ? (
          <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-slate-400">
            No class probabilities available — this step has not been classified by a model.
          </p>
        ) : (
          order.map((c) => (
            <ConfidenceBar
              key={c}
              label={c}
              value={probs[c] ?? 0}
              accent={c === shownClass ? (c === 'HEAVY' ? 'warn' : 'ok') : 'slate'}
            />
          ))
        )}
      </div>

      {low && (
        <p className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] p-3 text-xs text-amber-200">
          Low confidence — below the configured threshold of {(settings.confidenceThreshold * 100).toFixed(0)}%.
          Additional sensor data is recommended before treating this label as reliable.
        </p>
      )}

      {!compact && features && (
        <>
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="label">Detected features</span>
              <ProvenanceTag kind="MEASURED" />
            </div>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(FEATURE_LABEL) as (keyof StepFeatures)[]).map((k) => (
                <div key={k} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <dt className="text-[10px] uppercase tracking-wider text-slate-500">{FEATURE_LABEL[k]}</dt>
                  <dd className="mt-0.5 font-mono text-sm text-slate-100">{featureValue(k, features)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-4 rounded-lg border border-violet-400/20 bg-violet-400/[0.05] p-4">
            <div className="flex items-center gap-2">
              <CircleHelp className="h-4 w-4 text-violet-300" strokeWidth={1.8} />
              <h4 className="text-sm font-medium text-violet-200">Why this prediction?</h4>
              <span className="ml-auto">
                <PredictionTag source={pred?.source ?? packet.prediction_source} />
              </span>
            </div>

            {contributions && (
              <div className="mt-3 space-y-2">
                <p className="label">
                  {model.connected ? 'Model feature importance' : 'Heuristic feature contribution'}
                </p>
                {(Object.keys(FEATURE_LABEL) as (keyof StepFeatures)[]).map((k) => (
                  <div key={k} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-[11px] text-slate-400">{FEATURE_LABEL[k]}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500/60 to-violet-300 transition-[width] duration-500"
                        style={{ width: `${Math.min(100, (contributions[k] ?? 0) * 220)}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right font-mono text-[11px] text-slate-300">
                      {featureValue(k, features)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <ul className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
              {reasons.map((r) => (
                <li key={r} className="flex gap-2 text-xs leading-relaxed text-slate-400">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400" />
                  {r}
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-white/5 pt-2 text-[11px] text-slate-400">
              Model confidence: <span className="font-mono text-slate-200">{fmtConfidence(shownConfidence)}</span>{' '}
              — a probabilistic estimate, not a measurement.
            </p>
          </div>
        </>
      )}
    </Panel>
  )
}

/* ---------------------------- ENERGY JOURNEY ----------------------------- */
export function EnergyJourney() {
  const { packet, stats, settings } = useStore()
  if (!packet) return null
  const stored = storedEnergyJ(packet.storage_voltage, settings.supercapFarads)
  const stages = [
    {
      icon: Footprints,
      name: 'Footstep',
      value: stats.total.toLocaleString(),
      unit: 'steps in range',
      tag: 'MEASURED',
    },
    {
      icon: CircuitBoard,
      name: 'Piezoelectric Mat',
      value: stats.peakV.toFixed(2),
      unit: 'V peak harvested',
      tag: 'MEASURED',
    },
    { icon: Zap, name: 'Rectifier', value: packet.peak_voltage.toFixed(2), unit: 'V rectified now', tag: 'MEASURED' },
    {
      icon: BatteryCharging,
      name: 'Energy Storage',
      value: packet.storage_voltage.toFixed(2),
      unit: `V · ${stored.toFixed(2)} J stored`,
      tag: 'ESTIMATED',
    },
    { icon: Radio, name: 'ESP32 Monitoring', value: `${packet.wifi_rssi}`, unit: 'dBm · streaming', tag: 'MEASURED' },
    {
      icon: Lightbulb,
      name: 'Load',
      value:
        packet.loads.led.actualState === null
          ? 'LED —'
          : packet.loads.led.actualState
            ? 'LED ON'
            : 'LED OFF',
      unit:
        packet.loads.fan.actualState === null
          ? 'Fan state not reported'
          : packet.loads.fan.actualState
            ? 'Fan ON'
            : 'Fan OFF',
      tag: packet.loads.led.actualState === null ? 'UNAVAILABLE' : 'MEASURED',
    },
  ]
  return (
    <Panel
      title="Energy Journey"
      subtitle="Live values at each stage of the harvesting chain"
      icon={Zap}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {stages.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={s.name} className="relative">
              <div className="h-full rounded-lg border border-white/[0.07] bg-white/[0.025] p-3 transition-colors hover:border-volt/30">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-volt" strokeWidth={1.8} />
                  <span className="text-[11px] font-medium text-slate-300">{s.name}</span>
                </div>
                <p className="mt-2 font-mono text-lg font-semibold text-white">{s.value}</p>
                <p className="text-[10px] text-slate-500">{s.unit}</p>
                <div className="mt-2">
                  <ProvenanceTag kind={s.tag} />
                </div>
              </div>
              {i < stages.length - 1 && (
                <>
                  {/* animated flow indicator — horizontal on wide screens */}
                  <span className="pointer-events-none absolute -right-1 top-1/2 hidden h-px w-2 -translate-y-1/2 bg-volt/40 xl:block" />
                  <span className="pointer-events-none absolute -right-1.5 top-1/2 hidden h-1.5 w-1.5 -translate-y-1/2 animate-flowx rounded-full bg-volt xl:block" />
                  <ArrowDown className="mx-auto my-1 h-3 w-3 text-slate-700 xl:hidden" />
                </>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        Energy values are estimated from available electrical measurements (½CV²); current is not measured on
        this prototype.
      </p>
    </Panel>
  )
}

/* --------------------------- Energy storage card ------------------------- */
export function EnergyStorageCard() {
  const { packet, settings, series } = useStore()
  if (!packet) return null
  const v = packet.storage_voltage
  const pct = Math.max(0, Math.min(100, (v / settings.storageTargetV) * 100))
  const prev = series.length > 3 ? series[series.length - 4].storage : v
  const charging = v >= prev
  const stored = storedEnergyJ(v, settings.supercapFarads)
  const vals = series.map((s) => s.storage)
  const tone = v < settings.minOperatingV ? 'crit' : v < settings.lowStorageAlertV ? 'warn' : 'ok'
  const healthy = v >= settings.minOperatingV && v <= settings.maxSafeV

  return (
    <Panel
      title="Supercapacitor"
      subtitle={`C = ${settings.supercapFarads} F · target ${settings.storageTargetV} V · operating window ${settings.minOperatingV}–${settings.maxSafeV} V (all configurable in Settings)`}
      icon={BatteryCharging}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <div className="relative h-36 w-20 overflow-hidden rounded-lg border-2 border-white/15 bg-ink-950/60">
            <div
              className={`absolute bottom-0 left-0 right-0 transition-[height] duration-700 ease-out ${
                tone === 'crit'
                  ? 'bg-gradient-to-t from-rose-600/70 to-rose-400/50'
                  : tone === 'warn'
                    ? 'bg-gradient-to-t from-amber-600/70 to-amber-400/50'
                    : 'bg-gradient-to-t from-emerald-600/70 to-emerald-400/50'
              }`}
              style={{ height: `${pct}%` }}
            />
            <div className="absolute inset-0 grid place-items-center">
              <span className="font-mono text-lg font-semibold text-white drop-shadow">{pct.toFixed(0)}%</span>
            </div>
          </div>
          <span className="-ml-3 h-6 w-1.5 rounded-r bg-white/15" />
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-semibold text-white">
              <AnimatedNumber value={v} decimals={2} />
            </span>
            <span className="text-slate-500">V</span>
            <ProvenanceTag kind="MEASURED" />
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={charging ? 'ok' : 'warn'} pulse={charging}>
              {charging ? 'CHARGING' : 'DISCHARGING'}
            </StatusBadge>
            <StatusBadge tone={healthy ? 'ok' : 'warn'}>{healthy ? 'Healthy' : 'Out of window'}</StatusBadge>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {[
              ['Current storage', `${v.toFixed(2)} V`],
              ['Percent of target', `${pct.toFixed(0)}%`],
              ['Minimum observed', `${(vals.length ? Math.min(...vals) : v).toFixed(2)} V`],
              ['Maximum observed', `${(vals.length ? Math.max(...vals) : v).toFixed(2)} V`],
              ['Min threshold (cfg)', `${settings.minOperatingV.toFixed(2)} V`],
              ['Max safe (cfg)', `${settings.maxSafeV.toFixed(2)} V`],
              ['Stored energy (est.)', `${stored.toFixed(2)} J`],
              ['Target', `${settings.storageTargetV.toFixed(2)} V`],
            ].map(([k, val]) => (
              <div key={k} className="flex justify-between gap-2 border-b border-white/[0.04] pb-1">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-mono text-slate-200">{val}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] text-slate-500">
            Percentage is relative to the configured target voltage, not an absolute state of charge.
          </p>
        </div>
      </div>
    </Panel>
  )
}

/* ------------------------- Electrical measurement ------------------------ */
export function ElectricalPanel() {
  const { packet, settings } = useStore()
  if (!packet) return null
  const rows: [string, string, string][] = [
    ['Voltage (storage)', `${packet.storage_voltage.toFixed(2)} V`, 'MEASURED'],
    ['Current', packet.current_a === null ? 'Not measured' : `${packet.current_a.toFixed(3)} A`, packet.current_a === null ? 'UNAVAILABLE' : 'MEASURED'],
    [
      'Power',
      packet.power_w === null ? 'Not measured' : `${(packet.power_w * 1000).toFixed(1)} mW`,
      packet.power_w === null ? 'UNAVAILABLE' : 'CALCULATED',
    ],
    [
      'Energy',
      packet.measured_energy_j !== null
        ? `${packet.measured_energy_j.toFixed(3)} J`
        : `${storedEnergyJ(packet.storage_voltage, settings.supercapFarads).toFixed(2)} J`,
      packet.measured_energy_j !== null ? 'CALCULATED' : 'ESTIMATED',
    ],
  ]
  return (
    <Panel title="Electrical Measurements" icon={Gauge} subtitle="What the hardware actually provides right now">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.map(([k, v, tag]) => (
          <div key={k} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <dt className="label">{k}</dt>
            <dd className={`mt-1 font-mono text-sm ${v === 'Not measured' ? 'text-slate-500' : 'text-slate-100'}`}>{v}</dd>
            <div className="mt-2">
              <ProvenanceTag kind={tag} />
            </div>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] text-slate-500">
        Energy values are estimated from available electrical measurements. Add a current-sense front-end to
        upgrade power and energy from estimated to calculated.
      </p>
    </Panel>
  )
}

/* ---------------------------- Load status card --------------------------- */
/**
 * Phase 14 — the honest load control surface.
 *
 * The dashboard writes a COMMAND to the backend API. Only the ESP32 can report what
 * the GPIO actually did. So we always render both:
 *
 *   COMMAND  — what the dashboard asked for
 *   ACTUAL   — what the firmware confirmed (or "Not reported" / DEVICE OFFLINE)
 *
 * We never flip the UI to "ON" just because the user tapped a switch.
 */
export function LoadStatusCard() {
  const { packet, loads, setLoad, settings, health } = useStore()
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [err, setErr] = useState<string | null>(null)
  if (!packet) return null

  const available = storedEnergyJ(packet.storage_voltage, settings.supercapFarads)
  const controllable = packet.load_control_available
  const deviceOffline = health.esp32 === 'offline'

  const rows = [
    { key: 'led' as const, name: 'LED', icon: Lightbulb, draw: '~1.6 mW', state: loads.led },
    { key: 'fan' as const, name: '5V DC Fan', icon: Fan, draw: '~6.2 mW', state: loads.fan },
  ]

  const send = async (key: 'led' | 'fan', v: boolean) => {
    setErr(null)
    setPending((p) => ({ ...p, [key]: true }))
    try {
      await setLoad(key, v)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setPending((p) => ({ ...p, [key]: false }))
    }
  }

  return (
    <Panel
      title="Demonstration Loads"
      subtitle={
        controllable
          ? 'Dashboard writes a command to the backend API; the ESP32 confirms the actual GPIO state.'
          : 'Firmware reports status only — no control surface is exposed, so none is shown.'
      }
      icon={Lightbulb}
      actions={deviceOffline ? <StatusBadge tone="crit">DEVICE OFFLINE</StatusBadge> : undefined}
    >
      {deviceOffline && (
        <p className="mb-3 rounded-lg border border-rose-400/25 bg-rose-400/[0.07] p-3 text-xs text-rose-200">
          The ESP32 is not reporting. Commands can still be queued in MongoDB, but no load can be
          confirmed as switched until the device reconnects.
        </p>
      )}
      <div className="space-y-2.5">
        {rows.map((l) => {
          const Icon = l.icon
          const { command, actualState } = l.state
          const unknown = actualState === null || deviceOffline
          const mismatch = !unknown && actualState !== command
          return (
            <div
              key={l.key}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`h-4 w-4 ${!unknown && actualState ? 'text-amber-300' : 'text-slate-600'}`}
                  strokeWidth={1.8}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-200">{l.name}</p>
                  <p className="text-[11px] text-slate-500">Estimated draw {l.draw}</p>
                </div>
                {controllable && (
                  <Toggle
                    checked={command}
                    onChange={(v) => void send(l.key, v)}
                    label={`Command ${l.name}`}
                  />
                )}
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-2.5">
                <div>
                  <span className="label">Command</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <StatusBadge tone={command ? 'ok' : 'idle'}>{command ? 'ON' : 'OFF'}</StatusBadge>
                    {pending[l.key] && <span className="text-[10px] text-slate-500">sending…</span>}
                  </div>
                </div>
                <div>
                  <span className="label">Actual hardware state</span>
                  <div className="mt-1">
                    {unknown ? (
                      <StatusBadge tone="idle">{deviceOffline ? 'UNKNOWN — OFFLINE' : 'NOT REPORTED'}</StatusBadge>
                    ) : (
                      <StatusBadge tone={mismatch ? 'warn' : actualState ? 'ok' : 'idle'}>
                        {actualState ? 'ON' : 'OFF'}
                      </StatusBadge>
                    )}
                  </div>
                </div>
              </div>
              {mismatch && (
                <p className="mt-2 text-[11px] text-amber-300">
                  Command and hardware state disagree — the device has not applied this command yet.
                </p>
              )}
            </div>
          )
        })}
      </div>
      {err && (
        <p className="mt-3 rounded-lg border border-rose-400/25 bg-rose-400/[0.07] p-2.5 text-xs text-rose-200">
          Command failed: {err}
        </p>
      )}
      <div className="mt-4 flex items-end justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
        <div>
          <span className="label">Available stored energy</span>
          <p className="mt-1 font-mono text-2xl font-semibold text-white">
            <AnimatedNumber value={available} decimals={1} /> <span className="text-sm text-slate-500">J</span>
          </p>
        </div>
        <div className="text-right text-[11px] text-slate-500">
          <ProvenanceTag kind="ESTIMATED" />
          <p className="mt-1">
            {packet.power_w === null
              ? `Load power ≈ ${estPowerMw(packet.storage_voltage).toFixed(2)} mW (calculated)`
              : `Load power ${(packet.power_w * 1000).toFixed(1)} mW (measured)`}
          </p>
        </div>
      </div>
    </Panel>
  )
}

/* --------------------------- PIEZO ARRAY HEALTH -------------------------- */
export function PiezoArrayHealth() {
  const { piezo, mode } = useStore()
  const STATE_STYLE: Record<string, string> = {
    healthy: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    weak: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    inactive: 'border-white/10 bg-white/5 text-slate-500',
    fault: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  }
  return (
    <Panel
      title="Piezo Array Health"
      icon={CircuitBoard}
      subtitle={mode === 'demo' ? 'Simulated per-element diagnostics' : 'Per-element diagnostics reported by firmware'}
      actions={mode === 'demo' ? <StatusBadge tone="warn">SIMULATED</StatusBadge> : undefined}
    >
      {!piezo ? (
        <EmptyState
          title="Per-element diagnostics unavailable — aggregate output only"
          message="This hardware measures the combined PIEZO ARRAY OUTPUT through a single rectifier, so individual element health cannot be inferred. Wiring each element to its own ADC channel and publishing devices/{id}/piezoArray would enable it; the UI is ready for that data."
        />
      ) : (
        <>
          <div className="grid grid-cols-5 gap-2">
            {piezo.map((p) => (
              <div
                key={p.id}
                title={`${p.id} · ${p.state} · ${p.voltage.toFixed(2)} V · ${p.activityCount} activations · last ${fmtTime(p.lastActive)}`}
                className={`rounded-lg border p-2 text-center transition-transform hover:scale-[1.04] ${STATE_STYLE[p.state]}`}
              >
                <p className="font-mono text-xs font-semibold">{p.id}</p>
                <p className="mt-0.5 font-mono text-[10px] opacity-80">{p.voltage.toFixed(1)}V</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
            {(['healthy', 'weak', 'inactive', 'fault'] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5 capitalize">
                <span className={`h-2 w-2 rounded-full border ${STATE_STYLE[s]}`} />
                {s} ({piezo.filter((p) => p.state === s).length})
              </span>
            ))}
          </div>
        </>
      )}
    </Panel>
  )
}

/* ---------------------------- Activity timeline -------------------------- */
export function ActivityTimeline({ limit = 10 }: { limit?: number }) {
  const { events } = useStore()
  return (
    <Panel title="Footstep Events" subtitle="Live event stream from the detection pipeline" icon={Footprints}>
      {events.length === 0 ? (
        <EmptyState
          title="No footstep data available yet."
          message="Step on the mat (or use Simulate footstep in demo mode) to generate the first event."
        />
      ) : (
        <ol className="relative space-y-0">
          {events.slice(0, limit).map((e, i) => (
            <li
              key={e.id}
              className={`flex items-center gap-3 border-l border-white/[0.07] py-2 pl-4 ${i === 0 ? 'animate-fadeup' : ''}`}
            >
              <span
                className={`absolute -ml-[21px] h-2 w-2 rounded-full ${
                  e.step_class === 'HEAVY' ? 'bg-amber-400' : e.step_class === 'LIGHT' ? 'bg-volt' : 'bg-emerald-400'
                }`}
              />
              <time className="font-mono text-xs text-slate-500">{fmtTime(e.timestamp)}</time>
              <StatusBadge tone={classTone(e.step_class)}>{e.step_class}</StatusBadge>
              <span className="ml-auto font-mono text-xs text-slate-400">
                {e.peak_voltage.toFixed(2)} V · {e.pulse_duration_ms} ms
              </span>
              <span className="hidden font-mono text-xs text-slate-500 sm:inline">
                {fmtConfidence(e.confidence)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

/* ------------------------------ AI insight ------------------------------- */
export function AIInsightCard({ insight }: { insight: AiInsight }) {
  const Icon = {
    'ENERGY INSIGHT': Zap,
    'FOOTSTEP INSIGHT': Footprints,
    'STORAGE INSIGHT': BatteryCharging,
    'ANOMALY INSIGHT': ShieldAlert,
  }[insight.type]
  return (
    <article className="panel panel-hover p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-volt" strokeWidth={1.8} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{insight.type}</span>
        <span className="ml-auto font-mono text-[11px] text-slate-500">
          Confidence {(insight.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <p className="mt-2.5 text-sm leading-relaxed text-slate-200">{insight.text}</p>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500/60 to-volt"
          style={{ width: `${insight.confidence * 100}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
        <span className="font-mono">{insight.supporting}</span>
        <time>{fmtTime(insight.timestamp)}</time>
      </div>
    </article>
  )
}

/* ------------------------------ Anomaly card ----------------------------- */
export function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const crit = anomaly.level === 'CRITICAL'
  return (
    <article
      className={`rounded-lg border p-4 ${crit ? 'border-rose-400/25 bg-rose-400/[0.06]' : 'border-amber-400/20 bg-amber-400/[0.05]'}`}
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert className={`mt-0.5 h-4 w-4 shrink-0 ${crit ? 'text-rose-400' : 'text-amber-400'}`} strokeWidth={1.8} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className={`text-sm font-medium uppercase tracking-wide ${crit ? 'text-rose-200' : 'text-amber-200'}`}>
              {anomaly.label}
            </h4>
            <div className="flex gap-1.5">
              <StatusBadge tone={crit ? 'crit' : 'warn'}>{anomaly.level}</StatusBadge>
              <StatusBadge tone="idle">{anomaly.status}</StatusBadge>
            </div>
          </div>
          <dl className="mt-2 space-y-1 text-xs">
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-slate-500">Detected at</dt>
              <dd className="font-mono text-slate-300">{fmtTime(anomaly.timestamp)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-slate-500">Reason</dt>
              <dd className="text-slate-300">{anomaly.reason}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-slate-500">Evidence</dt>
              <dd className="font-mono text-slate-400">{anomaly.metric}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-slate-500">Rule score</dt>
              <dd className="font-mono text-slate-300">{(anomaly.score * 100).toFixed(0)}%</dd>
            </div>
          </dl>
        </div>
      </div>
    </article>
  )
}

/* --------------------------- Energy score card --------------------------- */
export function EnergyScoreCard() {
  const { stats, health, series, settings } = useStore()
  const vals = series.map((s) => s.live)
  const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  const sd = vals.length ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) : 1
  const stability = Math.round(Math.max(40, 100 - sd * 28))
  const activity = Math.round(Math.min(100, (stats.total / 250) * 100))
  const storagePerf = Math.round(Math.min(100, ((series.at(-1)?.storage ?? 0) / settings.storageTargetV) * 100))
  const availability = health.healthScore
  const score = Math.round(activity * 0.3 + stability * 0.25 + storagePerf * 0.25 + availability * 0.2)
  const rows = [
    ['Footstep Activity', activity],
    ['Voltage Stability', stability],
    ['Storage Performance', storagePerf],
    ['System Availability', availability],
  ] as const
  return (
    <Panel
      title="Energy Performance Score"
      subtitle="Project-defined performance score — a composite index created for this project. It is NOT a universal engineering standard."
      icon={Sparkles}
    >
      <div className="flex items-center gap-5">
        <div className="relative grid h-24 w-24 shrink-0 place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="#22d3ee"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(score / 100) * 264} 264`}
              className="transition-[stroke-dasharray] duration-700"
            />
          </svg>
          <span className="font-mono text-2xl font-semibold text-white">{score}</span>
        </div>
        <div className="flex-1 space-y-2.5">
          {rows.map(([k, v]) => (
            <ConfidenceBar key={k} label={k} value={v / 100} accent={v > 80 ? 'ok' : v > 60 ? 'volt' : 'warn'} />
          ))}
        </div>
      </div>
      <p className="mt-4 text-[11px] text-slate-500">
        Weighting: activity 30% · stability 25% · storage 25% · availability 20%. Score is out of 100.
      </p>
    </Panel>
  )
}

/* --------------------------- System health card -------------------------- */
export function SystemHealthCard() {
  const { health, mode } = useStore()
  const rows: [string, string, 'ok' | 'warn' | 'crit' | 'idle'][] = [
    ['ESP32', health.esp32.toUpperCase(), health.esp32 === 'online' ? 'ok' : 'crit'],
    ['Wi-Fi', health.wifi.toUpperCase(), health.wifi === 'connected' ? 'ok' : 'crit'],
    [
      'Database',
      mode === 'demo' ? 'NOT USED (DEMO)' : health.cloud.toUpperCase(),
      mode === 'demo' ? 'idle' : health.cloud === 'connected' ? 'ok' : 'crit',
    ],
    ['Sensor', health.sensor.toUpperCase(), health.sensor === 'normal' ? 'ok' : health.sensor === 'unknown' ? 'idle' : 'warn'],
    ['ML Service', health.mlService.toUpperCase(), health.mlService === 'online' ? 'ok' : health.mlService === 'demo' ? 'idle' : 'crit'],
    ['Dashboard', health.dashboard.toUpperCase(), health.dashboard === 'live' ? 'ok' : 'warn'],
  ]
  return (
    <Panel
      title="System Health"
      icon={Gauge}
      subtitle={`Last data received ${health.lastDataMs ? Math.max(1, Math.round(health.lastDataMs / 1000)) : 0} s ago`}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map(([k, v, tone]) => (
          <div key={k} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="label">{k}</p>
            <div className="mt-2">
              <StatusBadge tone={tone} pulse={tone === 'ok' && k === 'ESP32'}>
                {v}
              </StatusBadge>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

/* ------------------------ Phase 38 — status panel ------------------------ */
/**
 * Compact system status strip. Every cell reflects ACTUAL observed state —
 * nothing here is cosmetic or hard-coded.
 */
export function SystemStatusPanel() {
  const { health, mode, connection, mlHealth, mlKind, device, packet, awaitingLiveData } = useStore()

  const tone = (ok: boolean, warn = false): 'ok' | 'warn' | 'crit' => (ok ? 'ok' : warn ? 'warn' : 'crit')

  const cells: Array<{ label: string; value: string; tone: 'ok' | 'warn' | 'crit' | 'idle'; note?: string }> = [
    {
      label: 'ESP32',
      value: health.esp32.toUpperCase(),
      tone: health.esp32 === 'online' ? 'ok' : health.esp32 === 'degraded' ? 'warn' : 'crit',
      note: device?.firmwareVersion ? `fw ${device.firmwareVersion}` : 'firmware unknown',
    },
    {
      label: 'Database',
      value:
        health.cloud === 'connected'
          ? 'CONNECTED'
          : health.cloud === 'not-configured'
            ? 'NOT CONFIGURED'
            : 'ERROR',
      tone: health.cloud === 'connected' ? 'ok' : health.cloud === 'not-configured' ? 'idle' : 'crit',
      note: mode === 'demo' ? 'not used in demo mode' : undefined,
    },
    {
      label: 'ML Service',
      value:
        mlKind !== 'api'
          ? 'NOT CONFIGURED'
          : !mlHealth
            ? 'CHECKING…'
            : !mlHealth.reachable
              ? 'OFFLINE'
              : mlHealth.modelLoaded
                ? 'MODEL LOADED'
                : 'NO MODEL',
      tone:
        mlKind !== 'api'
          ? 'idle'
          : mlHealth?.reachable
            ? mlHealth.modelLoaded
              ? 'ok'
              : 'warn'
            : 'crit',
      note: mlKind !== 'api' ? 'heuristic demo classifier' : (mlHealth?.version ?? undefined),
    },
    {
      label: 'Sensor',
      value: health.sensor.toUpperCase(),
      tone: health.sensor === 'normal' ? 'ok' : health.sensor === 'unknown' ? 'idle' : 'warn',
    },
    {
      label: 'Data Stream',
      value: awaitingLiveData
        ? 'WAITING'
        : connection === 'connected' && packet
          ? 'RECEIVING'
          : connection.toUpperCase(),
      tone: packet ? tone(connection === 'connected') : awaitingLiveData ? 'warn' : 'crit',
      note: packet ? `last packet ${Math.round(health.lastDataMs / 1000)}s ago` : 'no packets yet',
    },
    {
      label: 'Mode',
      value: mode === 'live' ? 'LIVE' : 'DEMO (SIMULATED)',
      tone: mode === 'live' ? 'ok' : 'idle',
    },
  ]

  return (
    <Panel title="System Status" icon={Activity}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {cells.map((c) => (
          <div key={c.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <p className="label">{c.label}</p>
            <div className="mt-1.5">
              <StatusBadge tone={c.tone}>{c.value}</StatusBadge>
            </div>
            {c.note && <p className="mt-1.5 truncate text-[10px] text-slate-500">{c.note}</p>}
          </div>
        ))}
      </div>
    </Panel>
  )
}
