import { useEffect, useState } from 'react'
import {
  FlaskConical,
  Play,
  Pause,
  Square,
  Plus,
  Download,
  Users,
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
  GitCompare,
  FileText,
} from 'lucide-react'
import { Panel, SectionTitle, StatusBadge } from '../components/ui'
import {
  listExperimentSessions,
  createExperimentSession,
  updateExperimentStatus,
  fetchExperimentSamples,
  fetchDatasetQuality,
} from '../services/api/phase2Service'
import type { ExperimentSession, DatasetQualityMetrics } from '../data/types'
import { useStore } from '../data/store'
import { ExperimentComparisonModal } from '../components/ExperimentComparisonModal'
import { ResearchReportModal } from '../components/ResearchReportModal'

export default function ExperimentMode() {
  const { mode } = useStore()
  const [sessions, setSessions] = useState<ExperimentSession[]>([])
  const [activeSession, setActiveSession] = useState<ExperimentSession | null>(null)
  const [quality, setQuality] = useState<DatasetQualityMetrics | null>(null)
  const [samples, setSamples] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showCompareModal, setShowCompareModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)

  // New session form state
  const [formName, setFormName] = useState('Gait Force & Harvesting Study')
  const [formParticipant, setFormParticipant] = useState('P001')
  const [formDevice, setFormDevice] = useState('ESP32-01')
  const [formClass, setFormClass] = useState<'LIGHT' | 'NORMAL' | 'HEAVY'>('NORMAL')
  const [formTarget, setFormTarget] = useState(50)
  const [formNotes, setFormNotes] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      if (mode === 'demo') {
        const demoSession: ExperimentSession = {
          sessionId: 'EXP_DEMO_01',
          experimentName: 'Lab Piezo Sensitivity Trial',
          participantId: 'P001',
          deviceId: 'ESP32-01',
          stepClass: 'NORMAL',
          targetSteps: 50,
          collectedSteps: 37,
          validSteps: 35,
          rejectedSteps: 2,
          status: 'RUNNING',
          startedAt: new Date().toISOString(),
        }
        setSessions([demoSession])
        setActiveSession(demoSession)
        setQuality({
          totalSamples: 142,
          uniqueParticipants: 6,
          distribution: { light: 46, normal: 51, heavy: 45 },
          classBalancePercent: 94,
          missingValuesCount: 0,
          rejectedSamplesCount: 3,
          waveformAvailabilityPercent: 100,
          measuredEnergyAvailabilityPercent: 88,
          isReadyForTraining: true,
          recommendations: ['Dataset is well-balanced and ready for ML training.'],
        })
        return
      }

      const [sessList, qual] = await Promise.all([
        listExperimentSessions('ESP32-01'),
        fetchDatasetQuality(),
      ])
      setSessions(sessList)
      setQuality(qual)

      const running = sessList.find((s) => s.status === 'RUNNING') || sessList[0] || null
      setActiveSession(running)

      if (running) {
        const smp = await fetchExperimentSamples(running.sessionId)
        setSamples(smp)
      }
    } catch (err) {
      console.error('Error loading experiment data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [mode])

  const handleStatusChange = async (newStatus: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED') => {
    if (!activeSession) return
    try {
      if (mode === 'demo') {
        setActiveSession({ ...activeSession, status: newStatus })
        return
      }
      const updated = await updateExperimentStatus(activeSession.sessionId, newStatus)
      setActiveSession(updated)
      void loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (mode === 'demo') {
        const newDemo: ExperimentSession = {
          sessionId: `EXP_${Date.now().toString(36).toUpperCase()}`,
          experimentName: formName,
          participantId: formParticipant,
          deviceId: formDevice,
          stepClass: formClass,
          targetSteps: formTarget,
          collectedSteps: 0,
          validSteps: 0,
          rejectedSteps: 0,
          status: 'PLANNED',
          notes: formNotes,
        }
        setSessions([newDemo, ...sessions])
        setActiveSession(newDemo)
        setShowNewModal(false)
        return
      }

      const created = await createExperimentSession({
        experimentName: formName,
        participantId: formParticipant,
        deviceId: formDevice,
        stepClass: formClass,
        targetSteps: formTarget,
        notes: formNotes,
      })
      setShowNewModal(false)
      setActiveSession(created)
      void loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create session')
    }
  }

  const progressPct = activeSession
    ? Math.min(100, Math.round((activeSession.collectedSteps / activeSession.targetSteps) * 100))
    : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle
          title="Academic Experiment Mode"
          sub="Structured data collection console for controlled footstep harvesting and model calibration"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn btn-secondary text-xs flex items-center gap-1.5"
            onClick={() => setShowCompareModal(true)}
            disabled={sessions.length < 2}
            title={sessions.length < 2 ? 'Need at least 2 sessions to compare' : 'Compare multiple sessions'}
          >
            <GitCompare className="h-3.5 w-3.5 text-cyan-400" /> Compare Trials
          </button>
          <button
            className="btn btn-secondary text-xs flex items-center gap-1.5"
            onClick={() => setShowReportModal(true)}
          >
            <FileText className="h-3.5 w-3.5 text-indigo-400" /> Research Report
          </button>
          <button className="btn btn-secondary text-xs" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button className="btn btn-primary text-xs" onClick={() => setShowNewModal(true)}>
            <Plus className="h-3 w-3" /> New Experiment
          </button>
        </div>
      </div>

      {/* Active Experiment Control HUD */}
      {activeSession ? (
        <Panel
          title={activeSession.experimentName}
          subtitle={`Session ID: ${activeSession.sessionId} · Target: ${activeSession.targetSteps} steps · Participant: ${activeSession.participantId}`}
          icon={FlaskConical}
          actions={
            <div className="flex items-center gap-2">
              <StatusBadge
                tone={activeSession.status === 'RUNNING' ? 'ok' : activeSession.status === 'PAUSED' ? 'warn' : 'idle'}
                pulse={activeSession.status === 'RUNNING'}
              >
                {activeSession.status}
              </StatusBadge>
              {activeSession.status !== 'RUNNING' && activeSession.status !== 'COMPLETED' && (
                <button
                  className="btn btn-primary text-xs py-1 px-2.5"
                  onClick={() => void handleStatusChange('RUNNING')}
                >
                  <Play className="h-3 w-3" /> Start
                </button>
              )}
              {activeSession.status === 'RUNNING' && (
                <button
                  className="btn btn-secondary text-xs py-1 px-2.5"
                  onClick={() => void handleStatusChange('PAUSED')}
                >
                  <Pause className="h-3 w-3" /> Pause
                </button>
              )}
              {activeSession.status !== 'COMPLETED' && (
                <button
                  className="btn btn-secondary text-xs py-1 px-2.5 hover:text-rose-400"
                  onClick={() => void handleStatusChange('COMPLETED')}
                >
                  <Square className="h-3 w-3" /> Complete
                </button>
              )}
            </div>
          }
        >
          <div className="space-y-4">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-mono">
                <span className="text-slate-400">Target Progress</span>
                <span className="text-white font-semibold">
                  {activeSession.collectedSteps} / {activeSession.targetSteps} steps ({progressPct}%)
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <span className="label">Operator Class</span>
                <p className="mt-1 font-mono text-base font-semibold text-sky-400">{activeSession.stepClass}</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <span className="label">Participant ID</span>
                <p className="mt-1 font-mono text-base font-semibold text-white">{activeSession.participantId}</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <span className="label">Valid Samples</span>
                <p className="mt-1 font-mono text-base font-semibold text-emerald-400">{activeSession.validSteps}</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <span className="label">Rejected Noise</span>
                <p className="mt-1 font-mono text-base font-semibold text-amber-400">{activeSession.rejectedSteps}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/api/experiments/${activeSession.sessionId}/export?format=csv`}
                  className="btn btn-secondary text-xs"
                  download
                >
                  <Download className="h-3 w-3" /> Download Research CSV
                </a>
                <a
                  href={`/api/experiments/${activeSession.sessionId}/export?format=json`}
                  className="btn btn-secondary text-xs"
                  download
                >
                  <FileSpreadsheet className="h-3 w-3" /> Download Metadata JSON
                </a>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {samples.length} waveform records indexed
              </span>
            </div>
          </div>
        </Panel>
      ) : (
        <Panel title="No Active Experiment" icon={FlaskConical}>
          <div className="py-8 text-center text-slate-400">
            <p className="text-sm">No experiment session is currently selected.</p>
            <button className="btn btn-primary text-xs mt-3" onClick={() => setShowNewModal(true)}>
              Create Your First Session
            </button>
          </div>
        </Panel>
      )}

      {/* Dataset Quality Panel */}
      {quality && (
        <Panel
          title="Dataset Academic Quality & Balance"
          subtitle="Real-time statistical verification of dataset integrity, class balance, and training readiness"
          icon={Users}
          actions={
            <StatusBadge tone={quality.isReadyForTraining ? 'ok' : 'warn'}>
              {quality.isReadyForTraining ? 'READY FOR TRAINING' : 'COLLECTION IN PROGRESS'}
            </StatusBadge>
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <span className="label">Total Samples</span>
              <p className="mt-1 font-mono text-lg font-semibold text-white">{quality.totalSamples}</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <span className="label">Participants</span>
              <p className="mt-1 font-mono text-lg font-semibold text-sky-400">{quality.uniqueParticipants}</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <span className="label">Class Balance</span>
              <p className="mt-1 font-mono text-lg font-semibold text-emerald-400">{quality.classBalancePercent}%</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <span className="label">Waveforms Present</span>
              <p className="mt-1 font-mono text-lg font-semibold text-purple-400">{quality.waveformAvailabilityPercent}%</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <span className="label">Rejected Samples</span>
              <p className="mt-1 font-mono text-lg font-semibold text-amber-400">{quality.rejectedSamplesCount}</p>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] text-xs space-y-1">
            <p className="text-slate-300 font-medium">Dataset Integrity Checks:</p>
            {quality.recommendations.map((rec, i) => (
              <p key={i} className="text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" /> {rec}
              </p>
            ))}
          </div>
        </Panel>
      )}

      {/* New Experiment Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-ink-950 p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-1">Create New Experiment Session</h3>
            <p className="text-xs text-slate-400 mb-4">
              Configure parameters for controlled data collection. Anonymized participant IDs protect subject privacy.
            </p>

            <form onSubmit={handleCreateSession} className="space-y-3.5">
              <div>
                <label className="label">Experiment Name</label>
                <input
                  type="text"
                  className="input mt-1 w-full text-xs"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Participant ID</label>
                  <input
                    type="text"
                    className="input mt-1 w-full text-xs font-mono"
                    placeholder="P001"
                    value={formParticipant}
                    onChange={(e) => setFormParticipant(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Device ID</label>
                  <input
                    type="text"
                    className="input mt-1 w-full text-xs font-mono"
                    placeholder="ESP32-01"
                    value={formDevice}
                    onChange={(e) => setFormDevice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Target Steps</label>
                <input
                  type="number"
                  min="5"
                  max="1000"
                  className="input mt-1 w-full text-xs font-mono"
                  value={formTarget}
                  onChange={(e) => setFormTarget(parseInt(e.target.value, 10))}
                  required
                />
              </div>

              <div>
                <label className="label">Target Ground-Truth Class</label>
                <select
                  className="input mt-1 w-full text-xs"
                  value={formClass}
                  onChange={(e) => setFormClass(e.target.value as any)}
                >
                  <option value="LIGHT">LIGHT (Soft toe strikes, low energy)</option>
                  <option value="NORMAL">NORMAL (Standard walking gait)</option>
                  <option value="HEAVY">HEAVY (Heel strikes, brisk stride)</option>
                </select>
              </div>

              <div>
                <label className="label">Notes / Observation</label>
                <textarea
                  className="input mt-1 w-full text-xs h-16"
                  placeholder="Shoe type, floor substrate, pace..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button type="button" className="btn btn-secondary text-xs" onClick={() => setShowNewModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs">
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Multi-Session Comparison Modal */}
      {showCompareModal && (
        <ExperimentComparisonModal
          sessions={sessions}
          onClose={() => setShowCompareModal(false)}
        />
      )}

      {/* Academic Research Report Modal */}
      {showReportModal && (
        <ResearchReportModal
          sessionId={activeSession?.sessionId}
          deviceId={activeSession?.deviceId}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  )
}
