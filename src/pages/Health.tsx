import { Cpu, Gauge, Signal, Timer, Database, Wifi } from 'lucide-react'
import { useStore } from '../data/store'
import iotImg from '../assets/visual-iot-network.jpg'
import { MetricCard, Panel, EmptyState, StatusBadge, VisualBanner } from '../components/ui'
import { SystemHealthCard, AnomalyCard, PiezoArrayHealth } from '../components/cards'
import { StorageChart } from '../components/charts'

const dur = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

export default function Health() {
  const { health, series, settings, anomalies, packet } = useStore()
  const loss = 100 - health.successRate
  const bars = Math.max(1, Math.min(4, Math.round((health.rssi + 95) / 13)))

  return (
    <div className="space-y-5">
      <VisualBanner image={iotImg} alt="ESP32 node linked over Wi-Fi to cloud infrastructure and a dashboard" eyebrow="ESP32 → Wi-Fi → Firebase → ML → Dashboard" title="System Health" sub="Device, link and pipeline status for the StepCharge node." />

      <SystemHealthCard />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Wi-Fi signal"
          value={health.rssi}
          unit="dBm"
          decimals={0}
          icon={Signal}
          tone={health.rssi > -70 ? 'ok' : 'warn'}
          sub={<span>{bars}/4 bars · {health.rssi > -70 ? 'Good' : 'Weak'}</span>}
          provenance="MEASURED"
        />
        {health.uptimeSec === null ? (
          <div className="panel p-4">
            <p className="label">Device uptime</p>
            <p className="mt-2 font-mono text-lg text-slate-400">Not reported</p>
            <p className="mt-1 text-[11px] text-slate-500">
              The firmware does not publish uptimeSec — the dashboard will not guess it.
            </p>
          </div>
        ) : (
          <MetricCard
            label="Device uptime"
            value={health.uptimeSec / 3600}
            unit="h"
            decimals={1}
            icon={Timer}
            sub={
              <span>
                {dur(health.uptimeSec)} since boot · <span className="text-slate-500">DEVICE REPORTED</span>
              </span>
            }
          />
        )}
        <MetricCard
          label="Packets received"
          value={health.packetsReceived}
          decimals={0}
          icon={Database}
          sub={
            <span>
              {health.packetsMissed} lost · {health.successRate.toFixed(2)}% success ({loss.toFixed(2)}% loss) ·{' '}
              <span className="text-slate-500">DASHBOARD CALCULATED</span>
            </span>
          }
        />
        {health.latencyMs === null ? (
          <div className="panel p-4">
            <p className="label">Packet age</p>
            <p className="mt-2 font-mono text-lg text-slate-400">No data received</p>
          </div>
        ) : (
          <MetricCard
            label="Time since last packet"
            value={health.latencyMs}
            unit="ms"
            decimals={0}
            icon={Cpu}
            tone={health.latencyMs < 5000 ? 'ok' : 'warn'}
            sub={<span className="text-slate-500">DASHBOARD CALCULATED — arrival gap, not link latency</span>}
          />
        )}
      </div>

      <PiezoArrayHealth />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Panel title="Storage rail stability" subtitle="Charging / discharging history of the supercapacitor" icon={Gauge}>
            <StorageChart data={series} min={settings.minOperatingV} max={settings.maxSafeV} height={240} />
          </Panel>
        </div>
        <div className="space-y-5 xl:col-span-5">
          <Panel title="Link details" icon={Wifi}>
            <dl className="space-y-2 text-xs">
              {[
                ['Device ID', health.deviceId],
                ['Firmware version', health.firmwareVersion],
                ['Last reboot', health.lastReboot],
                ['Last data received', `${Math.max(1, Math.round(health.lastDataMs / 1000))} s ago`],
                ['Transport', 'Wi-Fi 802.11 b/g/n → Firebase RTDB'],
                ['Firmware mode', packet?.load_control_available ? 'Telemetry + load control' : 'Telemetry only'],
                ['Health score', `${health.healthScore}%`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-white/[0.04] pb-2">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right font-mono text-slate-200">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel
            title="Recent anomalies"
            icon={Gauge}
            actions={<StatusBadge tone={anomalies.length ? 'warn' : 'ok'}>{anomalies.length}</StatusBadge>}
          >
            {anomalies.length === 0 ? (
              <EmptyState title="Nothing to review." message="No deviation from the rolling baseline in this session." tone="ok" />
            ) : (
              <div className="space-y-3">
                {anomalies.slice(0, 3).map((a) => (
                  <AnomalyCard key={a.id} anomaly={a} />
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
