import { useState, useEffect } from 'react'
import { Server, RefreshCw, AlertCircle } from 'lucide-react'
import { fetchSystemMonitor } from '../services/api/phase4Service'
import type { SystemMonitorData } from '../data/types'
import { Panel, StatusBadge } from './ui'

interface Props {
  deviceId?: string
}

export function SystemMonitorPanel({ deviceId }: Props) {
  const [monitor, setMonitor] = useState<SystemMonitorData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchSystemMonitor(deviceId)
      setMonitor(res)
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to backend system monitor.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const timer = setInterval(loadData, 15000)
    return () => clearInterval(timer)
  }, [deviceId])

  return (
    <Panel
      title="Production Service Mesh & Latency Breakdown"
      subtitle="Real-time multi-service heartbeat, sequence integrity, and end-to-end latency audit"
      icon={Server}
      actions={
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      }
    >
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Services Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {monitor?.services ? (
          <>
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">Database</span>
                <StatusBadge tone={monitor.services.database.isHealthy ? 'ok' : 'warn'}>
                  {monitor.services.database.status}
                </StatusBadge>
              </div>
              <p className="mt-2 font-mono text-sm font-semibold text-slate-200">
                {monitor.services.database.name}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">MongoDB Atlas</p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">Backend API</span>
                <StatusBadge tone={monitor.services.backend.isHealthy ? 'ok' : 'warn'}>
                  {monitor.services.backend.status}
                </StatusBadge>
              </div>
              <p className="mt-2 font-mono text-sm font-semibold text-slate-200">
                Node.js Express
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                Uptime: {Math.floor(monitor.services.backend.uptimeSec / 60)}m
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">Realtime</span>
                <StatusBadge tone={monitor.services.realtime.isHealthy ? 'ok' : 'warn'}>
                  {monitor.services.realtime.status}
                </StatusBadge>
              </div>
              <p className="mt-2 font-mono text-sm font-semibold text-slate-200">
                Socket.IO
              </p>
              <p className="mt-1 text-[10px] text-slate-500">Room Telemetry</p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">ML Microservice</span>
                <StatusBadge tone={monitor.services.mlService.isHealthy ? 'ok' : 'warn'}>
                  {monitor.services.mlService.status}
                </StatusBadge>
              </div>
              <p className="mt-2 font-mono text-sm font-semibold text-slate-200">
                FastAPI Python
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                {monitor.services.mlService.modelLoaded ? 'Model Loaded' : 'Awaiting Model'}
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">Edge Harvester</span>
                <StatusBadge tone={monitor.services.iotDevice.isHealthy ? 'ok' : 'warn'}>
                  {monitor.services.iotDevice.status}
                </StatusBadge>
              </div>
              <p className="mt-2 font-mono text-sm font-semibold text-slate-200 truncate">
                {monitor.services.iotDevice.name}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                FW: v{monitor.services.iotDevice.firmwareVersion}
              </p>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">Auth Gateway</span>
                <StatusBadge tone={monitor.services.googleAuth.isHealthy ? 'ok' : 'warn'}>
                  {monitor.services.googleAuth.status}
                </StatusBadge>
              </div>
              <p className="mt-2 font-mono text-sm font-semibold text-slate-200">
                Google OAuth
              </p>
              <p className="mt-1 text-[10px] text-slate-500">Strict JWT Verification</p>
            </div>
          </>
        ) : (
          <div className="col-span-full py-4 text-center text-xs text-slate-500">
            Connecting to production services monitor...
          </div>
        )}
      </div>

      {/* Latency and Sequence Metrics */}
      {monitor && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Latency Waterfall */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                End-to-End Latency Waterfall
              </span>
              <span className="font-mono text-xs text-cyan-400 font-bold">
                Total ~{monitor.endToEndLatency.totalRoundtripMs} ms
              </span>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">1. Edge Burst Sampling → Backend API</span>
                <span className="font-mono text-slate-200">
                  {monitor.endToEndLatency.sensorToBackendMs != null
                    ? `${monitor.endToEndLatency.sensorToBackendMs} ms`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">2. Backend Processing → MongoDB Atlas</span>
                <span className="font-mono text-slate-200">
                  {monitor.endToEndLatency.backendToDatabaseMs != null
                    ? `${monitor.endToEndLatency.backendToDatabaseMs} ms`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">3. Backend Realtime Broadcast → Dashboard</span>
                <span className="font-mono text-slate-200">
                  {monitor.endToEndLatency.backendToDashboardMs} ms
                </span>
              </div>
            </div>
            <div className="mt-3 flex h-2 w-full overflow-hidden rounded bg-slate-800">
              <div
                className="bg-emerald-500"
                style={{
                  width: `${Math.min(100, Math.max(10, ((monitor.endToEndLatency.sensorToBackendMs || 10) / monitor.endToEndLatency.totalRoundtripMs) * 100))}%`,
                }}
                title="Sensor to Backend"
              />
              <div
                className="bg-cyan-500"
                style={{
                  width: `${Math.min(100, Math.max(10, ((monitor.endToEndLatency.backendToDatabaseMs || 6) / monitor.endToEndLatency.totalRoundtripMs) * 100))}%`,
                }}
                title="Database Write"
              />
              <div
                className="bg-indigo-500"
                style={{
                  width: `${Math.min(100, Math.max(10, (monitor.endToEndLatency.backendToDashboardMs / monitor.endToEndLatency.totalRoundtripMs) * 100))}%`,
                }}
                title="Realtime Broadcast"
              />
            </div>
          </div>

          {/* Telemetry Sequence & Delivery Reliability */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Telemetry Packet Reliability (Rolling Window)
              </span>
              <StatusBadge
                tone={
                  monitor.telemetryReliability.successRatePercent >= 98
                    ? 'ok'
                    : monitor.telemetryReliability.successRatePercent >= 90
                      ? 'warn'
                      : 'crit'
                }
              >
                {monitor.telemetryReliability.successRatePercent}% Delivery
              </StatusBadge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded border border-slate-800 bg-slate-900/80 p-2">
                <p className="text-[10px] text-slate-500">Packets Observed</p>
                <p className="mt-1 font-mono text-base font-semibold text-slate-200">
                  {monitor.telemetryReliability.totalObserved}
                </p>
              </div>
              <div className="rounded border border-slate-800 bg-slate-900/80 p-2">
                <p className="text-[10px] text-slate-500">Sequence Gaps</p>
                <p className="mt-1 font-mono text-base font-semibold text-rose-300">
                  {monitor.telemetryReliability.packetsMissed}
                </p>
              </div>
              <div className="rounded border border-slate-800 bg-slate-900/80 p-2">
                <p className="text-[10px] text-slate-500">Average Gap Delay</p>
                <p className="mt-1 font-mono text-base font-semibold text-cyan-300">
                  {monitor.telemetryReliability.averageLatencyMs} ms
                </p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              Sequence integrity calculated from monotonic hardware counter in packet metadata.
            </p>
          </div>
        </div>
      )}
    </Panel>
  )
}
