import { useState } from 'react'
import { X, GitCompare, RefreshCw, AlertCircle, CheckSquare, Square } from 'lucide-react'
import { compareExperimentSessions } from '../services/api/phase4Service'
import type { ExperimentSession } from '../data/types'
import { StatusBadge } from './ui'

interface Props {
  sessions: ExperimentSession[]
  onClose: () => void
}

export function ExperimentComparisonModal({ sessions, onClose }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    sessions.slice(0, 3).map((s) => s.sessionId),
  )
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((s) => s !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  const runComparison = async () => {
    if (selectedIds.length < 2) {
      setError('Select at least 2 sessions to run comparative analysis.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await compareExperimentSessions(selectedIds)
      setResults(Array.isArray(res) ? res : (res as any)?.sessions || [])
    } catch (err: any) {
      setError(err?.message || 'Failed to compare experiment sessions.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-xl border border-white/10 bg-ink-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <GitCompare className="h-5 w-5 text-cyan-400" />
            <div>
              <h3 className="text-base font-semibold text-white">
                Multi-Session Experiment Comparison
              </h3>
              <p className="text-xs text-slate-400">
                Compare kinetic voltages, pulse duration, and capacitor energy yield across trials
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Session Selector Chips */}
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-300 mb-2">
            Select Sessions to Compare (Minimum 2):
          </p>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 border border-white/[0.06] rounded-lg bg-white/[0.02]">
            {sessions.map((s) => {
              const selected = selectedIds.includes(s.sessionId)
              return (
                <button
                  key={s.sessionId}
                  onClick={() => toggleSelect(s.sessionId)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
                    selected
                      ? 'border border-cyan-500/40 bg-cyan-500/20 text-cyan-200'
                      : 'border border-white/[0.06] bg-white/[0.04] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {selected ? <CheckSquare className="h-3.5 w-3.5 text-cyan-400" /> : <Square className="h-3.5 w-3.5" />}
                  <span className="font-medium">{s.experimentName}</span>
                  <span className="font-mono text-[10px] text-slate-500">({s.sessionId})</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {selectedIds.length} sessions selected
          </span>
          <button
            onClick={runComparison}
            disabled={loading || selectedIds.length < 2}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-cyan-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Run Comparative Analysis
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Results Table */}
        {results && results.length > 0 && (
          <div className="mt-5 space-y-4">
            <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[0.08] bg-white/[0.03] text-slate-400 uppercase font-mono text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Session</th>
                    <th className="py-2.5 px-3">Participant</th>
                    <th className="py-2.5 px-3">Class</th>
                    <th className="py-2.5 px-3">Valid Steps</th>
                    <th className="py-2.5 px-3">Peak Voltage (Mean ± SD)</th>
                    <th className="py-2.5 px-3">Pulse Duration</th>
                    <th className="py-2.5 px-3">Storage ΔV</th>
                    <th className="py-2.5 px-3">Energy Yield</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-slate-200 font-mono">
                  {results.map((r, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-sans font-medium text-white">
                        {r.name || r.experimentName || r.sessionId}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{r.participantId || 'N/A'}</td>
                      <td className="py-2.5 px-3">
                        <StatusBadge tone="idle">{r.stepClass || 'N/A'}</StatusBadge>
                      </td>
                      <td className="py-2.5 px-3 text-emerald-400">
                        {r.validSteps ?? r.footstepsCount ?? 0}
                      </td>
                      <td className="py-2.5 px-3">
                        {r.peakVoltage?.mean != null
                          ? `${r.peakVoltage.mean.toFixed(2)} V ± ${r.peakVoltage.stdDev?.toFixed(2) || '0.00'} V`
                          : r.meanPeakVoltage != null
                            ? `${r.meanPeakVoltage.toFixed(2)} V`
                            : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3">
                        {r.pulseDuration?.mean != null
                          ? `${r.pulseDuration.mean.toFixed(1)} ms`
                          : r.meanPulseDuration != null
                            ? `${r.meanPulseDuration.toFixed(1)} ms`
                            : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-cyan-300">
                        {r.storageVoltage?.delta != null
                          ? `+${r.storageVoltage.delta.toFixed(3)} V`
                          : r.storageDeltaV != null
                            ? `+${r.storageDeltaV.toFixed(3)} V`
                            : '0.000 V'}
                      </td>
                      <td className="py-2.5 px-3">
                        {r.energy?.perStepJoules != null ? (
                          <span>
                            {(r.energy.perStepJoules * 1000).toFixed(3)} mJ/step{' '}
                            <span className="text-[10px] text-slate-400">({r.energy.type})</span>
                          </span>
                        ) : r.energyYieldJ != null ? (
                          <span>
                            {(r.energyYieldJ * 1000).toFixed(3)} mJ{' '}
                            <span className="text-[10px] text-slate-400">({r.energyYieldType})</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">Not Measured</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-slate-500">
              * Energy yield is derived from either instantaneous current shunt integration [MEASURED] or capacitor delta 0.5·C·Δ(V²) [ESTIMATED].
            </p>
          </div>
        )}

        <div className="mt-5 flex justify-end border-t border-white/[0.08] pt-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
