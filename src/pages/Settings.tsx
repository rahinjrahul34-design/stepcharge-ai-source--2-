import { BellRing, BrainCircuit, Cpu, Monitor, ShieldCheck, Zap, RotateCcw } from 'lucide-react'
import { DEFAULT_SETTINGS, useStore } from '../data/store'
import { Panel, SectionTitle, StatusBadge, Toggle } from '../components/ui'
import { DataSourceSwitch } from '../components/layout'
import type { Settings as S, StepClass } from '../data/types'

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.04] py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-slate-200">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
      </div>
      <div className="w-full sm:w-48">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const { settings, updateSettings, health, mlBaseUrl, device } = useStore()
  const registered = device
  const wifiOk = health.wifi === 'connected'
  const num = (k: keyof S, step = 0.1) => (
    <input
      type="number"
      step={step}
      className="input text-right font-mono"
      value={settings[k] as number}
      onChange={(e) => updateSettings({ [k]: Number(e.target.value) } as Partial<S>)}
    />
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle title="Settings" sub="Thresholds configured here drive every alert, gauge and guard band in the dashboard" />
        <button className="btn" onClick={() => updateSettings(DEFAULT_SETTINGS)}>
          <RotateCcw className="h-3.5 w-3.5" /> Restore defaults
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Device Settings" icon={Cpu}>
          <Row label="Data source" hint="Switch between simulated demo telemetry and the live ESP32 stream.">
            <DataSourceSwitch compact />
          </Row>
          <Row
            label="Registered device"
            hint="Read back from the devices/{id} record — not editable from the dashboard"
          >
            <input
              className="input font-mono text-xs"
              readOnly
              value={
                registered
                  ? `${registered.name} · ${registered.location} · fw ${registered.firmwareVersion}`
                  : 'No device record found'
              }
            />
          </Row>
          <Row label="Device name" hint="Stored in the device registration record">
            <input
              className="input"
              value={settings.deviceName}
              onChange={(e) => updateSettings({ deviceName: e.target.value })}
            />
          </Row>
          <Row label="Device location" hint="Where this mat is installed">
            <input
              className="input"
              value={settings.deviceLocation}
              onChange={(e) => updateSettings({ deviceLocation: e.target.value })}
            />
          </Row>
          <Row label="ML API URL" hint="Set VITE_ML_API_URL in .env.local — shown here read-only for verification">
            <input className="input font-mono text-xs" value={mlBaseUrl ?? 'not configured'} readOnly />
          </Row>
          <Row label="ESP32 device ID">
            <input
              className="input font-mono"
              value={settings.deviceId}
              onChange={(e) => updateSettings({ deviceId: e.target.value })}
            />
          </Row>
          <Row label="Wi-Fi status" hint="Credentials live in firmware / env vars and are never shown here.">
            <div className="flex sm:justify-end">
              <StatusBadge tone={wifiOk ? 'ok' : 'crit'} pulse={wifiOk}>
                {wifiOk ? 'CONNECTED' : 'DISCONNECTED'}
              </StatusBadge>
            </div>
          </Row>
          <Row label="Sampling interval" hint="ADC sampling period on the device (ms)">
            {num('samplingIntervalMs', 1)}
          </Row>
          <Row label="Data transmission interval" hint="Telemetry publish period (ms)">
            {num('txIntervalMs', 50)}
          </Row>
        </Panel>

        <Panel title="Energy Settings" icon={Zap}>
          <Row label="Storage voltage threshold" hint="Target used for the storage percentage gauge (V)">
            {num('storageTargetV')}
          </Row>
          <Row label="Minimum operating voltage" hint="Below this the demo load cannot run (V)">{num('minOperatingV')}</Row>
          <Row label="Maximum safe voltage" hint="Critical alert above this value (V)">{num('maxSafeV')}</Row>
          <Row label="Supercapacitor maximum voltage" hint="Rated ceiling — must match MAX_STORAGE_VOLTAGE in firmware (V)">
            {num('maxSafeV')}
          </Row>
          <Row label="Storage warning voltage" hint="Warn when approaching the ceiling — mirrors WARNING_STORAGE_VOLTAGE (V)">
            {num('warnStorageV')}
          </Row>
          <Row label="Supercapacitor capacitance" hint="Used by the ½CV² energy estimate (F)">
            {num('supercapFarads', 0.1)}
          </Row>
          <Row label="Energy calculation mode" hint="Auto uses measured power when the hardware provides it">
            <select
              className="input"
              value={settings.energyMode}
              onChange={(e) => updateSettings({ energyMode: e.target.value as S['energyMode'] })}
            >
              <option value="auto">Auto (prefer measured)</option>
              <option value="estimate">Always estimate (½CV²)</option>
              <option value="measured">Require measured power</option>
            </select>
          </Row>
        </Panel>

        <Panel title="AI Settings" icon={BrainCircuit}>
          <Row label="Model name">
            <input
              className="input"
              value={settings.modelName}
              onChange={(e) => updateSettings({ modelName: e.target.value })}
            />
          </Row>
          <Row label="Classification threshold" hint="Minimum probability to accept the argmax label">
            {num('classificationThreshold', 0.05)}
          </Row>
          <Row label="Confidence threshold" hint="Below this the UI flags the prediction as low confidence">
            {num('confidenceThreshold', 0.05)}
          </Row>
          <Row label="Enabled classes" hint="Classes the classifier is allowed to report">
            <div className="flex flex-wrap gap-1.5 sm:justify-end">
              {(['LIGHT', 'NORMAL', 'HEAVY'] as StepClass[]).map((c) => {
                const on = settings.enabledClasses.includes(c)
                return (
                  <button
                    key={c}
                    onClick={() =>
                      updateSettings({
                        enabledClasses: on
                          ? settings.enabledClasses.filter((x) => x !== c)
                          : [...settings.enabledClasses, c],
                      })
                    }
                    className={`rounded-md border px-2 py-1 text-[11px] ${
                      on ? 'border-volt/30 bg-volt/10 text-volt' : 'border-white/10 text-slate-500'
                    }`}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
          </Row>
        </Panel>

        <Panel title="Alert Settings" icon={BellRing}>
          <Row label="Enable alerts">
            <div className="flex sm:justify-end">
              <Toggle checked={settings.alertsEnabled} onChange={(v) => updateSettings({ alertsEnabled: v })} />
            </div>
          </Row>
          <Row label="Low storage alert" hint="Warning when storage falls below this value (V)">
            {num('lowStorageAlertV')}
          </Row>
          <Row label="Voltage spike alert" hint="Warning above this instantaneous peak (V)">{num('spikeAlertV')}</Row>
          <Row
            label="Footstep detection threshold"
            hint="Envelope voltage above which the firmware counts a step (V) — must match the sketch"
          >
            {num('footstepThresholdV', 0.05)}
          </Row>
          <Row label="Debounce window" hint="Minimum gap between two counted steps (ms)">
            {num('debounceMs', 5)}
          </Row>
          <Row label="Offline timeout" hint="Seconds without telemetry before the device is marked offline">
            {num('offlineTimeoutSec', 1)}
          </Row>
        </Panel>

        <Panel title="Dashboard Settings" icon={Monitor}>
          <Row label="Theme">
            <div className="flex gap-1.5 sm:justify-end">
              {(['dark', 'light'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => updateSettings({ theme: t })}
                  className={`rounded-md px-3 py-1.5 text-xs capitalize ${
                    settings.theme === t ? 'bg-volt/15 text-volt' : 'text-slate-400 hover:bg-white/5'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Chart refresh rate" hint="UI redraw interval (ms)">{num('refreshRateMs', 50)}</Row>
          <Row label="Units">
            <select
              className="input"
              value={settings.units}
              onChange={(e) => updateSettings({ units: e.target.value as S['units'] })}
            >
              <option value="SI">SI (V, J, mW)</option>
              <option value="mixed">Mixed (V, mJ, mW)</option>
            </select>
          </Row>
        </Panel>

        <Panel title="Security & data handling" icon={ShieldCheck}>
          <ul className="space-y-2 text-xs leading-relaxed text-slate-400">
            {[
              'Wi-Fi passwords, Firebase admin keys, service-account JSON and ML API secrets are never stored in or rendered by the client.',
              'All backend credentials are injected through environment variables at build time (VITE_FIREBASE_*).',
              'Incoming telemetry is validated (range + type checks) before it reaches any chart.',
              'Null or out-of-range readings are discarded rather than plotted as zero.',
              'No personally identifying information is collected — only anonymous footstep physics.',
              'Firebase Security Rules should restrict the browser client to read-only access.',
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                {t}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
