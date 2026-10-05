import { useState } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Gauge,
  Play,
} from 'lucide-react'
import { Panel, StatusBadge } from './ui'
import { runSystemSelfTest } from '../services/api/phase2Service'
import type { SelfTestReport, SelfTestResult } from '../data/types'
import { useStore } from '../data/store'

export function SystemSelfTestPanel({ deviceId }: { deviceId?: string }) {
  const { mode } = useStore()
  const [report, setReport] = useState<SelfTestReport | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRun = async () => {
    setRunning(true)
    setError(null)

    if (mode === 'demo') {
      setTimeout(() => {
        const demoResults: SelfTestResult[] = [
          {
            component: 'MongoDB Persistence',
            status: 'PASS',
            details: 'MongoDB Atlas connection active and responsive.',
            timestamp: new Date().toISOString(),
          },
          {
            component: 'Machine Learning Service',
            status: 'PASS',
            details: 'Python Random Forest ML microservice responding (Model: Loaded).',
            timestamp: new Date().toISOString(),
          },
          {
            component: 'ESP32 Device Connection',
            status: 'PASS',
            details: 'Device registered and actively transmitting telemetry packets.',
            timestamp: new Date().toISOString(),
          },
          {
            component: 'Supercapacitor Voltage Rail',
            status: 'PASS',
            details: 'Supercapacitor rail voltage within safe operational envelope (1.20 V - 5.00 V).',
            timestamp: new Date().toISOString(),
          },
          {
            component: 'Current Sensing Hardware',
            status: 'NOT_INSTALLED',
            details: 'Current sensor not installed on this hardware prototype (honest report).',
            timestamp: new Date().toISOString(),
          },
          {
            component: 'Piezoelectric Array',
            status: 'PASS',
            details: 'Harvester input ADC channels reporting baseline noise floor < 0.05 V.',
            timestamp: new Date().toISOString(),
          },
        ]
        setReport({
          timestamp: new Date().toISOString(),
          overallStatus: 'HEALTHY',
          results: demoResults,
        })
        setRunning(false)
      }, 600)
      return
    }

    try {
      const res = await runSystemSelfTest(deviceId)
      setReport(res)
    } catch (err: any) {
      setError(err?.message || 'Self-test diagnostic failed to complete.')
    } finally {
      setRunning(false)
    }
  }

  const statusTone = (status: string) => {
    switch (status) {
      case 'PASS':
      case 'HEALTHY':
        return 'ok'
      case 'WARNING':
      case 'DEGRADED':
        return 'warn'
      case 'FAIL':
      case 'CRITICAL':
        return 'crit'
      case 'NOT_INSTALLED':
      case 'NOT_TESTABLE':
      default:
        return 'idle'
    }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'PASS':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      case 'WARNING':
        return <AlertTriangle className="h-4 w-4 text-amber-400" />
      case 'FAIL':
        return <XCircle className="h-4 w-4 text-rose-400" />
      case 'NOT_INSTALLED':
      case 'NOT_TESTABLE':
      default:
        return <HelpCircle className="h-4 w-4 text-slate-400" />
    }
  }

  return (
    <Panel
      title="Hardware & Pipeline Self-Test"
      subtitle="Comprehensive component diagnostics across ESP32 ADC, I2C current sensor, supercapacitor, MongoDB Atlas, and Python ML"
      icon={Gauge}
      actions={
        <div className="flex items-center gap-2">
          {report && (
            <StatusBadge tone={statusTone(report.overallStatus)} pulse={running}>
              OVERALL: {report.overallStatus}
            </StatusBadge>
          )}
          <button className="btn btn-primary text-xs" onClick={handleRun} disabled={running}>
            {running ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin" /> Diagnosing…
              </>
            ) : (
              <>
                <Play className="h-3 w-3" /> Run Self-Test
              </>
            )}
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

      {!report && !running && (
        <div className="py-6 text-center text-xs text-slate-500">
          Click <strong>Run Self-Test</strong> to initiate end-to-end hardware, database, and machine-learning diagnostics.
        </div>
      )}

      {report && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Target: <strong className="text-slate-300">{deviceId || 'Primary Device'}</strong>
            </span>
            <span>Last executed: {new Date(report.timestamp).toLocaleTimeString()}</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.results.map((res, i) => (
              <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {statusIcon(res.status)}
                    <span className="text-xs font-medium text-slate-200">{res.component}</span>
                  </div>
                  <StatusBadge tone={statusTone(res.status)}>
                    {res.status}
                  </StatusBadge>
                </div>
                <p className="text-[11px] text-slate-400">{res.details}</p>
                <p className="text-[10px] text-slate-600 font-mono">
                  {new Date(res.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  )
}
