import { Activity, BatteryCharging, Play, Gauge, RefreshCw } from 'lucide-react'
import { useStore } from '../data/store'
import { LiveVoltageChart, StorageChart } from '../components/charts'
import { MetricCard, Panel, SectionTitle, EmptyState } from '../components/ui'
import {
  ActivityTimeline,
  ElectricalPanel,
  FootstepDetectedCard,
  LoadStatusCard,
} from '../components/cards'
import { estPowerMw } from '../data/energy'
import { StatusBadge } from '../components/ui'

export default function Live() {
  const { series, packet, settings, simulateStep, health, mode, connection, connectionError, retry, isStale } =
    useStore()

  if (connection === 'connecting')
    return <EmptyState title="Connecting…" message="Subscribing to the telemetry stream." />
  if (connection === 'error')
    return (
      <EmptyState
        title="Unable to receive live telemetry."
        message={connectionError ?? 'The data source could not be reached.'}
        tone="crit"
        action={
          <button className="btn" onClick={retry}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry connection
          </button>
        }
      />
    )
  if (!packet)
    return (
      <EmptyState
        title="ESP32 is offline."
        message="No telemetry received yet. Live charts resume automatically when the device reconnects."
        tone="crit"
        action={
          <button className="btn" onClick={retry}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry connection
          </button>
        }
      />
    )

  const live = series.map((s) => s.live)
  const cur = live.at(-1) ?? 0
  const peak = live.length ? Math.max(...live) : 0
  const avg = live.length ? live.reduce((a, b) => a + b, 0) / live.length : 0
  const min = live.length ? Math.min(...live) : 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle
          title="Live Monitoring"
          sub="Streaming window of the last 90 telemetry packets · updated via subscription, not page refresh"
        />
        <div className="flex items-center gap-2">
          <StatusBadge tone={isStale ? 'warn' : 'ok'} pulse={!isStale}>
            {isStale ? 'STREAM STALLED' : 'STREAM LIVE'}
          </StatusBadge>
          {mode === 'demo' && (
            <button className="btn btn-primary" onClick={() => simulateStep()}>
              <Play className="h-3.5 w-3.5" /> Simulate footstep
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Current" value={cur} unit="V" icon={Activity} provenance="MEASURED" />
        <MetricCard label="Peak (window)" value={peak} unit="V" tone="warn" provenance="MEASURED" />
        <MetricCard label="Average (window)" value={avg} unit="V" provenance="CALCULATED" />
        <MetricCard label="Minimum (window)" value={min} unit="V" tone="idle" provenance="MEASURED" />
      </div>

      <div className="panel grid grid-cols-2 gap-4 p-4 lg:grid-cols-5">
        {[
          ['Current voltage', `${cur.toFixed(2)} V`],
          ['Storage voltage', `${packet.storage_voltage.toFixed(2)} V`],
          ['Current step', packet.step_class],
          ['AI confidence', packet.confidence === null ? 'Not available' : `${(packet.confidence * 100).toFixed(0)}%`],
          ['Estimated energy', `${packet.estimated_energy_j.toFixed(2)} J`],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="label">{k}</p>
            <p className="mt-1 font-mono text-lg font-semibold text-white">{v}</p>
          </div>
        ))}
      </div>

      <FootstepDetectedCard />

      <Panel
        title="Live Voltage Output"
        subtitle="Rectified harvester output measured by the ESP32 ADC. Dashed line marks the session peak."
        icon={Activity}
        provenance="MEASURED"
      >
        <LiveVoltageChart data={series} peak={peak} height={300} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Panel
            title="Storage Voltage"
            subtitle={`Supercapacitor terminal voltage · guard bands at ${settings.minOperatingV} V and ${settings.maxSafeV} V (from Settings)`}
            icon={BatteryCharging}
            provenance="MEASURED"
          >
            <StorageChart data={series} min={settings.minOperatingV} max={settings.maxSafeV} height={240} />
            <p className="mt-3 text-[11px] text-slate-500">
              Calculated instantaneous load power ≈{' '}
              <span className="font-mono text-slate-300">{estPowerMw(packet.storage_voltage).toFixed(2)} mW</span>{' '}
              (V²/R_eq — current is not measured on this prototype).
            </p>
          </Panel>
        </div>
        <div className="space-y-5 xl:col-span-5">
          <ActivityTimeline limit={20} />
          <ElectricalPanel />
          <LoadStatusCard />
        </div>
      </div>

      <Panel title="Acquisition parameters" icon={Gauge}>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ['Sampling interval', `${settings.samplingIntervalMs} ms`],
            ['Transmission interval', `${settings.txIntervalMs} ms`],
            ['Device ID', packet.device_id],
            ['Firmware', packet.firmware_version],
            ['Link latency', `${health.latencyMs} ms`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <dt className="label">{k}</dt>
              <dd className="mt-1 font-mono text-sm text-slate-100">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  )
}
