import { useEffect, useState } from 'react'
import { Cpu, RefreshCw, Send, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { Panel, StatusBadge } from './ui'
import { fetchDeviceConfig, updateDeviceConfig, type DeviceConfigResponse } from '../services/api/phase2Service'
import type { DeviceRemoteConfig } from '../data/types'
import { useStore } from '../data/store'

export function RemoteConfigPanel({ deviceId }: { deviceId?: string }) {
  const { mode } = useStore()
  const [configData, setConfigData] = useState<DeviceConfigResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form edit state matching DeviceRemoteConfig
  const [form, setForm] = useState<Partial<DeviceRemoteConfig>>({
    samplingIntervalMs: 20,
    telemetryIntervalMs: 250,
    stepThresholdVoltage: 0.25,
    stepReleaseVoltage: 0.15,
    minPulseDurationMs: 30,
    maxPulseDurationMs: 1500,
    refractoryPeriodMs: 120,
    storageMaxSafeVoltage: 5.0,
    storageWarningVoltage: 4.8,
    storageLowVoltage: 2.0,
    supercapFarads: 0.1,
  })

  const loadConfig = async () => {
    if (mode === 'demo') {
      const demoCfg: DeviceRemoteConfig = {
        version: 3,
        samplingIntervalMs: 20,
        telemetryIntervalMs: 250,
        stepThresholdVoltage: 0.25,
        stepReleaseVoltage: 0.15,
        minPulseDurationMs: 30,
        maxPulseDurationMs: 1500,
        refractoryPeriodMs: 120,
        storageMaxSafeVoltage: 5.0,
        storageWarningVoltage: 4.8,
        storageLowVoltage: 2.0,
        voltageCalibrationScale: 1.0,
        voltageCalibrationOffset: 0.0,
        currentCalibrationScale: 1.0,
        currentCalibrationOffset: 0.0,
        supercapFarads: 0.1,
        updatedAt: new Date().toISOString(),
      }
      setConfigData({
        deviceId: deviceId || 'ESP32_DEMO_01',
        desired: demoCfg,
        applied: {
          version: 3,
          status: 'SYNCHRONIZED',
          appliedAt: new Date().toISOString(),
        },
        syncStatus: 'SYNCHRONIZED',
        isSynchronized: true,
      })
      setForm(demoCfg)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetchDeviceConfig(deviceId)
      setConfigData(res)
      if (res?.desired) {
        setForm({
          samplingIntervalMs: res.desired.samplingIntervalMs,
          telemetryIntervalMs: res.desired.telemetryIntervalMs,
          stepThresholdVoltage: res.desired.stepThresholdVoltage,
          stepReleaseVoltage: res.desired.stepReleaseVoltage,
          minPulseDurationMs: res.desired.minPulseDurationMs,
          maxPulseDurationMs: res.desired.maxPulseDurationMs,
          refractoryPeriodMs: res.desired.refractoryPeriodMs,
          storageMaxSafeVoltage: res.desired.storageMaxSafeVoltage,
          storageWarningVoltage: res.desired.storageWarningVoltage,
          storageLowVoltage: res.desired.storageLowVoltage,
          supercapFarads: res.desired.supercapFarads,
        })
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch hardware configuration.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadConfig()
  }, [deviceId, mode])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Local validation
    if (form.samplingIntervalMs! < 5 || form.samplingIntervalMs! > 1000) {
      setError('Sampling interval must be between 5 ms and 1000 ms.')
      return
    }
    if (form.telemetryIntervalMs! < 200 || form.telemetryIntervalMs! > 60000) {
      setError('Telemetry interval must be between 200 ms and 60,000 ms.')
      return
    }
    if (form.stepReleaseVoltage! >= form.stepThresholdVoltage!) {
      setError('Release voltage must be strictly lower than trigger threshold.')
      return
    }
    if (form.storageMaxSafeVoltage! < 1.0 || form.storageMaxSafeVoltage! > 5.5) {
      setError('Max safe storage ceiling must be between 1.0 V and 5.5 V.')
      return
    }
    if (form.storageWarningVoltage! >= form.storageMaxSafeVoltage!) {
      setError('Warning threshold must be strictly below maximum safe voltage ceiling.')
      return
    }

    if (mode === 'demo') {
      const updatedVersion = (configData?.desired.version || 1) + 1
      const updated: DeviceRemoteConfig = {
        ...form,
        version: updatedVersion,
        updatedAt: new Date().toISOString(),
      } as DeviceRemoteConfig
      setConfigData({
        deviceId: deviceId || 'ESP32_DEMO_01',
        desired: updated,
        applied: {
          version: updatedVersion,
          status: 'SYNCHRONIZED',
          appliedAt: new Date().toISOString(),
        },
        syncStatus: 'SYNCHRONIZED',
        isSynchronized: true,
      })
      setSuccess(`Simulated configuration updated (v${updatedVersion}).`)
      return
    }

    setSaving(true)
    try {
      const res = await updateDeviceConfig(deviceId, form)
      setConfigData(res)
      setSuccess(`Desired configuration v${res.desired.version} deployed to cloud queue. Awaiting ESP32 sync.`)
    } catch (err: any) {
      setError(err?.message || 'Failed to update remote hardware configuration.')
    } finally {
      setSaving(false)
    }
  }

  const syncTone =
    configData?.syncStatus === 'SYNCHRONIZED' ? 'ok' : configData?.syncStatus === 'PENDING' ? 'warn' : 'crit'

  return (
    <Panel
      title="ESP32 Remote Configuration"
      subtitle="Over-the-air parameter orchestration with desired vs applied version control and safety enforcement"
      icon={Cpu}
      actions={
        <div className="flex items-center gap-2">
          {configData && (
            <StatusBadge tone={syncTone} pulse={configData.syncStatus === 'PENDING'}>
              {configData.syncStatus} {configData.applied ? `(v${configData.applied.version})` : ''}
            </StatusBadge>
          )}
          <button className="btn btn-secondary text-xs" onClick={loadConfig} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      }
    >
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {configData?.applied?.status === 'REJECTED' && configData.applied.rejectionReason && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Firmware Rejected Applied Parameters:</p>
            <p className="font-mono">{configData.applied.rejectionReason}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">Sampling Interval (ms)</label>
            <p className="mb-1 text-[11px] text-slate-500">ESP32 ADC acquisition period (5 – 1000 ms)</p>
            <input
              type="number"
              min={5}
              max={1000}
              className="input font-mono"
              value={form.samplingIntervalMs ?? 20}
              onChange={(e) => setForm({ ...form, samplingIntervalMs: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="label">Telemetry Period (ms)</label>
            <p className="mb-1 text-[11px] text-slate-500">Wi-Fi POST broadcast interval (200 – 60,000 ms)</p>
            <input
              type="number"
              min={200}
              max={60000}
              className="input font-mono"
              value={form.telemetryIntervalMs ?? 250}
              onChange={(e) => setForm({ ...form, telemetryIntervalMs: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="label">Step Trigger Threshold (V)</label>
            <p className="mb-1 text-[11px] text-slate-500">Piezo envelope trigger threshold (0.1 – 20.0 V)</p>
            <input
              type="number"
              step={0.05}
              min={0.1}
              max={20.0}
              className="input font-mono"
              value={form.stepThresholdVoltage ?? 0.25}
              onChange={(e) => setForm({ ...form, stepThresholdVoltage: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="label">Step Release Threshold (V)</label>
            <p className="mb-1 text-[11px] text-slate-500">Hysteresis release voltage (&lt; Trigger Threshold)</p>
            <input
              type="number"
              step={0.05}
              min={0.05}
              max={15.0}
              className="input font-mono"
              value={form.stepReleaseVoltage ?? 0.15}
              onChange={(e) => setForm({ ...form, stepReleaseVoltage: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="label">Refractory Window (ms)</label>
            <p className="mb-1 text-[11px] text-slate-500">Minimum gap between counted steps (10 – 2000 ms)</p>
            <input
              type="number"
              min={10}
              max={2000}
              className="input font-mono"
              value={form.refractoryPeriodMs ?? 120}
              onChange={(e) => setForm({ ...form, refractoryPeriodMs: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="label">Supercapacitor Safe Limit (V)</label>
            <p className="mb-1 text-[11px] text-slate-500">Maximum safe ceiling (1.0 – 5.5 V safety limit)</p>
            <input
              type="number"
              step={0.1}
              min={1.0}
              max={5.5}
              className="input font-mono"
              value={form.storageMaxSafeVoltage ?? 5.0}
              onChange={(e) => setForm({ ...form, storageMaxSafeVoltage: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="label">Warning Threshold (V)</label>
            <p className="mb-1 text-[11px] text-slate-500">High-voltage warning (&lt; Safe Limit)</p>
            <input
              type="number"
              step={0.1}
              min={0.5}
              max={5.4}
              className="input font-mono"
              value={form.storageWarningVoltage ?? 4.8}
              onChange={(e) => setForm({ ...form, storageWarningVoltage: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="label">Low Voltage Cutoff (V)</label>
            <p className="mb-1 text-[11px] text-slate-500">Minimum operating voltage cutoff</p>
            <input
              type="number"
              step={0.1}
              min={0.5}
              max={4.0}
              className="input font-mono"
              value={form.storageLowVoltage ?? 2.0}
              onChange={(e) => setForm({ ...form, storageLowVoltage: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="label">Capacitance (F)</label>
            <p className="mb-1 text-[11px] text-slate-500">Supercapacitor farad rating for ½CV² calculation</p>
            <input
              type="number"
              step={0.01}
              min={0.01}
              max={10.0}
              className="input font-mono"
              value={form.supercapFarads ?? 0.1}
              onChange={(e) => setForm({ ...form, supercapFarads: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.04] pt-4">
          <div className="text-[11px] text-slate-500">
            {configData ? (
              <span>
                Desired: <strong className="text-slate-300">v{configData.desired.version}</strong> · Applied on HW:{' '}
                <strong className="text-slate-300">
                  {configData.applied ? `v${configData.applied.version}` : 'None'}
                </strong>
              </span>
            ) : (
              <span>Configuration offline</span>
            )}
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Send className="h-3.5 w-3.5" />
            {saving ? 'Transmitting to Cloud Queue…' : 'Deploy Configuration to Hardware'}
          </button>
        </div>
      </form>
    </Panel>
  )
}
