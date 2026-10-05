import { useState, useEffect } from 'react'
import {
  Sliders,
  AlertTriangle,
  RefreshCw,
  Zap,
  Activity,
  History,
  Check,
} from 'lucide-react'
import { Panel, SectionTitle, StatusBadge } from '../components/ui'
import {
  calibrateVoltage,
  calibrateCurrent,
  calibratePiezo,
  fetchCalibrationLogs,
} from '../services/api/phase2Service'
import type { CalibrationLog } from '../data/types'
import { useStore } from '../data/store'

export default function Calibration() {
  const { mode, packet } = useStore()
  const [logs, setLogs] = useState<CalibrationLog[]>([])
  const [loading, setLoading] = useState(false)

  // Voltage Calibration State
  const [refVoltage, setRefVoltage] = useState(4.20)
  const [measuredVoltage, setMeasuredVoltage] = useState(packet ? packet.storage_voltage : 3.98)
  const [voltResult, setVoltResult] = useState<any | null>(null)
  const [voltCalibrating, setVoltCalibrating] = useState(false)

  // Current Calibration State
  const hasCurrentSensor = packet?.current_a !== null && packet?.current_a !== undefined
  const [refCurrent, setRefCurrent] = useState(20.0)
  const [measuredCurrent, setMeasuredCurrent] = useState(19.2)
  const [currentResult, setCurrentResult] = useState<any | null>(null)
  const [currentCalibrating, setCurrentCalibrating] = useState(false)

  // Piezo Threshold State
  const [baselineNoise, setBaselineNoise] = useState(0.20)
  const [lightPeak, setLightPeak] = useState(1.10)
  const [piezoResult, setPiezoResult] = useState<any | null>(null)
  const [piezoCalibrating, setPiezoCalibrating] = useState(false)

  const loadLogs = async () => {
    setLoading(true)
    try {
      if (mode === 'demo') {
        setLogs([
          {
            _id: 'demo_log_01',
            deviceId: 'ESP32-01',
            calibrationType: 'VOLTAGE',
            referenceValue: 4.20,
            measuredValue: 3.98,
            previousScale: 1.0,
            newScale: 1.0553,
            errorPercent: 0.24,
            result: 'PASS',
            timestamp: new Date().toISOString(),
            notes: 'Multimeter baseline verification',
          },
        ])
        return
      }

      const l = await fetchCalibrationLogs('ESP32-01')
      setLogs(l)
    } catch (err) {
      console.error('Failed to load calibration logs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadLogs()
  }, [mode])

  // Execute Voltage Calibration
  const handleVoltageCalibrate = async (apply: boolean) => {
    setVoltCalibrating(true)
    try {
      if (mode === 'demo') {
        const errorPct = Math.abs(measuredVoltage - refVoltage) / refVoltage * 100
        const scale = refVoltage / measuredVoltage
        setVoltResult({
          referenceVoltage: refVoltage,
          measuredVoltage,
          newScale: Number(scale.toFixed(4)),
          errorPercent: Number(errorPct.toFixed(2)),
          applied: apply,
          status: errorPct <= 2.0 ? 'PASS' : 'WARNING_HIGH_DEVIATION',
        })
        return
      }

      const res = await calibrateVoltage('ESP32-01', {
        referenceVoltage: refVoltage,
        measuredVoltage,
        apply,
      })
      setVoltResult(res)
      void loadLogs()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Calibration failed')
    } finally {
      setVoltCalibrating(false)
    }
  }

  // Execute Current Calibration
  const handleCurrentCalibrate = async (apply: boolean) => {
    if (!hasCurrentSensor && mode !== 'demo') {
      alert('CURRENT SENSOR NOT INSTALLED: Calibration cannot proceed.')
      return
    }

    setCurrentCalibrating(true)
    try {
      if (mode === 'demo') {
        const errorPct = Math.abs(measuredCurrent - refCurrent) / refCurrent * 100
        const scale = refCurrent / measuredCurrent
        setCurrentResult({
          referenceCurrentMa: refCurrent,
          measuredCurrentMa: measuredCurrent,
          newScale: Number(scale.toFixed(4)),
          errorPercent: Number(errorPct.toFixed(2)),
          applied: apply,
          status: errorPct <= 3.0 ? 'PASS' : 'WARNING_HIGH_DEVIATION',
        })
        return
      }

      const res = await calibrateCurrent('ESP32-01', {
        referenceCurrentMa: refCurrent,
        measuredCurrentMa: measuredCurrent,
        apply,
      })
      setCurrentResult(res)
      void loadLogs()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Current calibration failed')
    } finally {
      setCurrentCalibrating(false)
    }
  }

  // Execute Piezo Thresholds Calibration
  const handlePiezoCalibrate = async (apply: boolean) => {
    setPiezoCalibrating(true)
    try {
      if (mode === 'demo') {
        const thresh = Number((baselineNoise + (lightPeak - baselineNoise) * 0.4).toFixed(2))
        const rel = Number((baselineNoise + (lightPeak - baselineNoise) * 0.15).toFixed(2))
        setPiezoResult({
          baselineNoiseV: baselineNoise,
          lightStepPeakV: lightPeak,
          recommendedThreshold: thresh,
          recommendedRelease: rel,
          applied: apply,
        })
        return
      }

      const res = await calibratePiezo('ESP32-01', {
        baselineNoiseV: baselineNoise,
        lightStepPeakV: lightPeak,
        apply,
      })
      setPiezoResult(res)
      void loadLogs()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Piezo threshold calibration failed')
    } finally {
      setPiezoCalibrating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle
          title="Hardware Sensor Calibration"
          sub="Interactive calibration console for analog ADC gain, current sensing, and footstep detection thresholds"
        />
        <button className="btn btn-secondary text-xs" onClick={() => void loadLogs()} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh Logs
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Section 1: Voltage Calibration Wizard */}
        <Panel
          title="Supercapacitor Voltage Calibration"
          subtitle="Compare ESP32 ADC readings against a calibrated digital multimeter (DMM)"
          icon={Zap}
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-slate-400 space-y-1">
              <p className="text-white font-medium">Measurement Procedure:</p>
              <p>1. Probe the supercapacitor positive terminal with your multimeter DC voltmeter.</p>
              <p>2. Enter the exact DMM reference voltage and observed ESP32 ADC reading below.</p>
              <p>3. Calculate the linear gain correction factor (Scale) and push to the ESP32.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Multimeter Reference (V)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.5"
                  max="5.5"
                  className="input mt-1 w-full text-xs font-mono"
                  value={refVoltage}
                  onChange={(e) => setRefVoltage(parseFloat(e.target.value))}
                />
              </div>
              <div>
                <label className="label">ESP32 Raw Reading (V)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.5"
                  max="5.5"
                  className="input mt-1 w-full text-xs font-mono"
                  value={measuredVoltage}
                  onChange={(e) => setMeasuredVoltage(parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                className="btn btn-secondary text-xs"
                onClick={() => void handleVoltageCalibrate(false)}
                disabled={voltCalibrating}
              >
                Test Gain Factor
              </button>
              <button
                className="btn btn-primary text-xs"
                onClick={() => void handleVoltageCalibrate(true)}
                disabled={voltCalibrating}
              >
                <Check className="h-3.5 w-3.5" /> Apply to ESP32
              </button>
            </div>

            {voltResult && (
              <div className="mt-3 rounded-lg border border-sky-400/20 bg-sky-400/[0.05] p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-sky-200">Calibration Result:</span>
                  <StatusBadge tone={voltResult.errorPercent <= 2.0 ? 'ok' : 'warn'}>
                    {voltResult.status}
                  </StatusBadge>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-xs text-slate-300">
                  <div>New Scale: <span className="text-white font-semibold">{voltResult.newScale}</span></div>
                  <div>Error: <span className="text-white font-semibold">{voltResult.errorPercent}%</span></div>
                  <div>Applied: <span className="text-white font-semibold">{voltResult.applied ? 'YES' : 'TEST ONLY'}</span></div>
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* Section 2: Current Calibration */}
        <Panel
          title="Current Sensor Calibration"
          subtitle="Calibration of I2C shunt current monitor (INA219 / INA226)"
          icon={Sliders}
        >
          {hasCurrentSensor || mode === 'demo' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Reference Current (mA)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="1000"
                    className="input mt-1 w-full text-xs font-mono"
                    value={refCurrent}
                    onChange={(e) => setRefCurrent(parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label">Sensor Measured (mA)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="1000"
                    className="input mt-1 w-full text-xs font-mono"
                    value={measuredCurrent}
                    onChange={(e) => setMeasuredCurrent(parseFloat(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  className="btn btn-secondary text-xs"
                  onClick={() => void handleCurrentCalibrate(false)}
                  disabled={currentCalibrating}
                >
                  Test Current Gain
                </button>
                <button
                  className="btn btn-primary text-xs"
                  onClick={() => void handleCurrentCalibrate(true)}
                  disabled={currentCalibrating}
                >
                  <Check className="h-3.5 w-3.5" /> Apply to ESP32
                </button>
              </div>

              {currentResult && (
                <div className="mt-3 rounded-lg border border-sky-400/20 bg-sky-400/[0.05] p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-sky-200">Current Calibration:</span>
                    <StatusBadge tone={currentResult.errorPercent <= 3.0 ? 'ok' : 'warn'}>
                      {currentResult.status}
                    </StatusBadge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-xs text-slate-300">
                    <div>New Scale: <span className="text-white font-semibold">{currentResult.newScale}</span></div>
                    <div>Error: <span className="text-white font-semibold">{currentResult.errorPercent}%</span></div>
                    <div>Applied: <span className="text-white font-semibold">{currentResult.applied ? 'YES' : 'TEST ONLY'}</span></div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/[0.08] bg-white/[0.01] p-6 text-center">
              <AlertTriangle className="h-6 w-6 text-amber-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-white">CURRENT SENSOR NOT INSTALLED</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No I2C current sensor (INA219/INA226) is physically detected on this prototype. System runs in voltage-only mode.
                Calibration is disabled to uphold academic integrity.
              </p>
            </div>
          )}
        </Panel>

        {/* Section 3: Piezoelectric Thresholds */}
        <Panel
          title="Piezoelectric Schmitt Trigger Thresholds"
          subtitle="Calibrate step detection trigger and hysteresis release voltage from signal characteristics"
          icon={Activity}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Baseline Noise Floor (V)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="2.0"
                  className="input mt-1 w-full text-xs font-mono"
                  value={baselineNoise}
                  onChange={(e) => setBaselineNoise(parseFloat(e.target.value))}
                />
              </div>
              <div>
                <label className="label">Light Step Peak (V)</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.3"
                  max="10.0"
                  className="input mt-1 w-full text-xs font-mono"
                  value={lightPeak}
                  onChange={(e) => setLightPeak(parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                className="btn btn-secondary text-xs"
                onClick={() => void handlePiezoCalibrate(false)}
                disabled={piezoCalibrating}
              >
                Calculate Thresholds
              </button>
              <button
                className="btn btn-primary text-xs"
                onClick={() => void handlePiezoCalibrate(true)}
                disabled={piezoCalibrating}
              >
                <Check className="h-3.5 w-3.5" /> Push Thresholds to ESP32
              </button>
            </div>

            {piezoResult && (
              <div className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] p-3.5 space-y-2">
                <span className="text-xs font-medium text-emerald-200">Recommended Thresholds:</span>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs text-slate-300">
                  <div>Rising Edge Trigger: <span className="text-white font-semibold">{piezoResult.recommendedThreshold} V</span></div>
                  <div>Hysteresis Release: <span className="text-white font-semibold">{piezoResult.recommendedRelease} V</span></div>
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* Section 4: Audit History */}
        <Panel title="Calibration Audit Trail" subtitle="Permanent record of hardware calibrations" icon={History}>
          {logs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] text-slate-400">
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Ref Value</th>
                    <th className="pb-2">Measured</th>
                    <th className="pb-2">Scale</th>
                    <th className="pb-2">Error</th>
                    <th className="pb-2">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {logs.map((l) => (
                    <tr key={l._id}>
                      <td className="py-2 font-medium text-white">{l.calibrationType}</td>
                      <td className="py-2 font-mono text-slate-300">{l.referenceValue}</td>
                      <td className="py-2 font-mono text-slate-300">{l.measuredValue}</td>
                      <td className="py-2 font-mono text-slate-300">{l.newScale}</td>
                      <td className="py-2 font-mono text-slate-300">{l.errorPercent}%</td>
                      <td className="py-2">
                        <StatusBadge tone={l.result === 'PASS' ? 'ok' : 'info'}>{l.result}</StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-slate-500">No calibration records logged yet.</p>
          )}
        </Panel>
      </div>
    </div>
  )
}
