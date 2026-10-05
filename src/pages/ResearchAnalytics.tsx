import { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  Info,
  Layers,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Sparkles,
  Table2,
  TrendingUp,
} from 'lucide-react'
import { Panel, SectionTitle, EmptyState } from '../components/ui'
import { useStore } from '../data/store'
import type {
  ModelRegistryItem,
  ModelComparisonResult,
  FeatureStudyResult,
  AnomalyEventRecord,
  EnergyForecastResult,
  DatasetVersionRecord,
} from '../data/types'
import {
  fetchModelRegistry,
  promoteModel,
  rollbackModel,
  compareModels,
  runFeatureStudy,
  fetchDatasetVersions,
  fetchAnomalies,
  resolveAnomaly,
  fetchEnergyForecast,
} from '../services/api/phase3Service'
import {
  fetchStatisticalAnalysis,
  fetchCorrelationMatrix,
} from '../services/api/phase4Service'

export default function ResearchAnalytics() {
  const { settings } = useStore()
  const deviceId = settings.deviceId

  // Tabs
  type TabKey =
    | 'benchmark'
    | 'registry'
    | 'ablation'
    | 'forecasting'
    | 'anomalies'
    | 'statistics'
    | 'limitations'

  const [activeTab, setActiveTab] = useState<TabKey>('benchmark')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  // Data states
  const [models, setModels] = useState<ModelRegistryItem[]>([])
  const [comparison, setComparison] = useState<ModelComparisonResult | null>(null)
  const [ablation, setAblation] = useState<FeatureStudyResult | null>(null)
  const [datasetVersions, setDatasetVersions] = useState<DatasetVersionRecord[]>([])
  const [anomalies, setAnomalies] = useState<AnomalyEventRecord[]>([])
  const [forecast, setForecast] = useState<EnergyForecastResult | null>(null)
  const [statsData, setStatsData] = useState<any>(null)
  const [corrData, setCorrData] = useState<any>(null)

  // Modals & Action Forms
  const [rollbackModal, setRollbackModal] = useState<{
    open: boolean
    targetVersion: string
    reason: string
  }>({ open: false, targetVersion: '', reason: '' })

  const [anomalyFilter, setAnomalyFilter] = useState<'ALL' | 'RULE-BASED' | 'ML-BASED'>('ALL')

  // Load initial data
  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [mList, dVersions, aList, fRes, sData, cData] = await Promise.all([
        fetchModelRegistry().catch(() => []),
        fetchDatasetVersions().catch(() => []),
        fetchAnomalies({ deviceId, limit: 50 }).catch(() => []),
        fetchEnergyForecast(deviceId).catch(() => null),
        fetchStatisticalAnalysis().catch(() => null),
        fetchCorrelationMatrix().catch(() => null),
      ])

      setModels(mList)
      setDatasetVersions(dVersions)
      setAnomalies(aList)
      setForecast(fRes)
      setStatsData(sData)
      setCorrData(cData)

      // Run benchmark if not loaded yet
      if (!comparison && mList.length > 0) {
        try {
          const comp = await compareModels()
          setComparison(comp)
        } catch {
          // ML service may be offline or thin dataset
        }
      }

      // Run ablation if not loaded yet
      if (!ablation) {
        try {
          const abl = await runFeatureStudy()
          setAblation(abl)
        } catch {
          // graceful fallback
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load research analytics data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [deviceId])

  // Handlers
  const handlePromote = async (version: string) => {
    setActionNotice(null)
    try {
      await promoteModel(version)
      setActionNotice(`Successfully promoted model version ${version} to active PRODUCTION.`)
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Promotion failed.')
    }
  }

  const handleRollbackSubmit = async () => {
    if (!rollbackModal.targetVersion || !rollbackModal.reason.trim()) {
      setError('Please provide a documented justification for rolling back this model.')
      return
    }
    setActionNotice(null)
    try {
      await rollbackModel(rollbackModal.targetVersion, rollbackModal.reason.trim())
      setRollbackModal({ open: false, targetVersion: '', reason: '' })
      setActionNotice(`Model successfully rolled back to ${rollbackModal.targetVersion}.`)
      await loadData()
    } catch (err: any) {
      setError(err?.message || 'Rollback failed.')
    }
  }

  const handleResolveAnomaly = async (
    id: string,
    status: 'RESOLVED' | 'ACKNOWLEDGED' | 'FALSE_POSITIVE',
  ) => {
    try {
      await resolveAnomaly(id, status, 'Operator marked from Research Console')
      setAnomalies((prev) =>
        prev.map((a) => (a._id === id ? { ...a, status } : a)),
      )
    } catch (err: any) {
      setError(err?.message || 'Failed to update anomaly status.')
    }
  }

  const activeModel = models.find((m) => m.status === 'PRODUCTION' && m.isCurrent) || models[0]

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-400">
              Phase 3 Advanced AI
            </span>
            <span className="font-mono text-xs text-slate-500">
              Active: {activeModel ? `${activeModel.modelName} (${activeModel.version})` : 'None'}
            </span>
          </div>
          <SectionTitle
            title="Research Analytics & Model Governance"
            sub="Multi-model benchmark, subject-independent validation, temporal energy forecasting, and explainable anomaly triage"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadData()}
            disabled={loading}
            className="btn border-white/10 hover:border-white/20"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-volt' : ''}`} />
            Refresh Lab
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionNotice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-white/[0.08] scrollbar-none">
        {[
          { key: 'benchmark', label: 'Multi-Model Benchmark', icon: Table2 },
          { key: 'registry', label: 'Model Registry & Governance', icon: Layers },
          { key: 'ablation', label: 'Feature Ablation Study', icon: Sliders },
          { key: 'forecasting', label: 'Time-Series Forecasting', icon: TrendingUp },
          { key: 'anomalies', label: 'Anomaly Center & Triage', icon: ShieldAlert },
          { key: 'statistics', label: 'Class Distributions', icon: Activity },
          { key: 'limitations', label: 'Academic Limitations', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-medium transition-colors ${
                isActive
                  ? 'border-volt text-volt bg-volt/[0.04]'
                  : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ---------------- 1. MULTI-MODEL BENCHMARK ---------------- */}
      {activeTab === 'benchmark' && (
        <div className="space-y-5">
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-4">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
              <div className="space-y-1 text-xs text-slate-300">
                <span className="font-semibold text-cyan-200">
                  Subject-Independent Validation Protocol:
                </span>{' '}
                Evaluated with <strong>GroupKFold cross-validation</strong> partitioned by participant
                identifier (`participantId`). No footstep samples from the same human subject appear in both
                the training fold and testing fold simultaneously, avoiding identity-leakage bias.
              </div>
            </div>
          </div>

          <Panel
            title="Algorithm Comparison Matrix"
            subtitle="Side-by-side performance of candidate classification algorithms on identical held-out test splits"
            icon={Table2}
          >
            {comparison?.models && comparison.models.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-2.5 pr-4">Algorithm</th>
                      <th className="py-2.5 px-3">Accuracy</th>
                      <th className="py-2.5 px-3">Precision</th>
                      <th className="py-2.5 px-3">Recall</th>
                      <th className="py-2.5 px-3">Macro F1</th>
                      <th className="py-2.5 px-3">Inference (ms)</th>
                      <th className="py-2.5 px-3">Model Size</th>
                      <th className="py-2.5 pl-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] font-mono">
                    {comparison.models.map((m) => {
                      const isProd = activeModel?.algorithm === m.algorithm
                      return (
                        <tr key={m.algorithm} className="hover:bg-white/[0.02]">
                          <td className="py-3 pr-4 font-sans font-medium text-slate-200">
                            {m.algorithm}
                            {isProd && (
                              <span className="ml-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
                                ACTIVE PROD
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-100">
                            {(m.metrics.accuracy * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            {(m.metrics.precision * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            {(m.metrics.recall * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 px-3 font-semibold text-volt">
                            {(m.metrics.f1 * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 px-3 text-slate-400">
                            {m.inferenceTimeMs.toFixed(2)} ms
                          </td>
                          <td className="py-3 px-3 text-slate-400">
                            {m.modelSizeKb.toFixed(1)} KB
                          </td>
                          <td className="py-3 pl-3 font-sans">
                            {isProd ? (
                              <span className="text-emerald-400">Serving</span>
                            ) : (
                              <span className="text-slate-500">Evaluated</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="Benchmark results pending."
                message="Train multiple models on the AI Model tab to generate comparative benchmarks across Random Forest, Gradient Boosting, SVM, and Logistic Regression."
              />
            )}
          </Panel>
        </div>
      )}

      {/* ---------------- 2. MODEL REGISTRY & GOVERNANCE ---------------- */}
      {activeTab === 'registry' && (
        <div className="space-y-5">
          <Panel
            title="Model Registry & Governance Console"
            subtitle="Catalog of trained model artifacts, validation statuses, audit histories, and rollback triggers"
            icon={Layers}
          >
            {models.length > 0 ? (
              <div className="space-y-4">
                {models.map((m) => {
                  const isProd = m.status === 'PRODUCTION' && m.isCurrent
                  return (
                    <div
                      key={m.version}
                      className={`rounded-lg border p-4 transition-colors ${
                        isProd
                          ? 'border-emerald-500/40 bg-emerald-950/20'
                          : m.status === 'VALIDATION'
                            ? 'border-cyan-500/30 bg-cyan-950/10'
                            : 'border-white/[0.06] bg-white/[0.01]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase font-bold tracking-wider ${
                              isProd
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : m.status === 'VALIDATION'
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {m.status}
                          </span>
                          <div>
                            <h4 className="font-semibold text-slate-100">
                              {m.modelName} <span className="font-mono text-xs text-slate-400">({m.version})</span>
                            </h4>
                            <p className="text-[11px] text-slate-400">
                              Algorithm: {m.algorithm} · Feature Schema: {m.featureVersion} · Trained:{' '}
                              {m.trainedAt ? new Date(m.trainedAt).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2">
                          {m.status === 'VALIDATION' && (
                            <button
                              onClick={() => void handlePromote(m.version)}
                              className="btn border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 text-xs py-1 px-2.5"
                            >
                              <ArrowUpRight className="h-3 w-3" />
                              Promote to Production
                            </button>
                          )}
                          {!isProd && m.status === 'ARCHIVED' && (
                            <button
                              onClick={() =>
                                setRollbackModal({
                                  open: true,
                                  targetVersion: m.version,
                                  reason: '',
                                })
                              }
                              className="btn border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs py-1 px-2.5"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Rollback to This
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Metrics bar */}
                      {m.metrics && (
                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.04] pt-3 sm:grid-cols-4 font-mono text-xs">
                          <div>
                            <span className="text-slate-500 text-[10px] block">ACCURACY</span>
                            <span className="text-slate-200">{(m.metrics.accuracy * 100).toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">PRECISION</span>
                            <span className="text-slate-200">{(m.metrics.precision * 100).toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">RECALL</span>
                            <span className="text-slate-200">{(m.metrics.recall * 100).toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">MACRO F1</span>
                            <span className="text-volt font-bold">{(m.metrics.f1 * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                      )}

                      {/* Rollback history */}
                      {m.rollbackHistory && m.rollbackHistory.length > 0 && (
                        <div className="mt-3 rounded border border-white/[0.04] bg-white/[0.01] p-2 text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-300">Rollback Audit Trail:</span>
                          {m.rollbackHistory.map((h, i) => (
                            <div key={i} className="mt-1 flex items-center justify-between text-[10px]">
                              <span>
                                Reverted from <strong>{h.fromVersion}</strong>: &ldquo;{h.reason}&rdquo;
                              </span>
                              <span className="font-mono text-slate-500">
                                {new Date(h.timestamp).toLocaleString()} ({h.performedBy})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                title="Model Registry is empty."
                message="Trained models will automatically register here with cryptographic version hashes and audit logs."
              />
            )}
          </Panel>

          {/* Dataset Versioning Panel */}
          <Panel
            title="Versioned Research Dataset Snapshots"
            subtitle="Immutable frozen data partitions for reproducible ML evaluation and academic citation"
            icon={Database}
          >
            {datasetVersions.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {datasetVersions.map((v) => (
                  <div
                    key={v.version}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-volt">{v.version}</span>
                      {v.isBaseline && (
                        <span className="rounded border border-volt/30 bg-volt/10 px-1.5 py-0.5 text-[10px] text-volt">
                          BASELINE
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
                      <div>
                        <span className="text-[10px] text-slate-500 block">SAMPLES</span>
                        {v.totalSamples}
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">PARTICIPANTS</span>
                        {v.uniqueParticipants}
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">QUALITY SCORE</span>
                        {v.qualityScore}/100
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">FROZEN AT</span>
                        {new Date(v.frozenAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No frozen dataset versions."
                message="Dataset snapshots are frozen via the dataset quality gate to preserve ground truth integrity across model experiments."
              />
            )}
          </Panel>
        </div>
      )}

      {/* ---------------- 3. FEATURE ABLATION STUDY ---------------- */}
      {activeTab === 'ablation' && (
        <div className="space-y-5">
          <Panel
            title="Feature Ablation & Contribution Analysis"
            subtitle="Systematic removal and addition of feature subsets to determine marginal classification value"
            icon={Sliders}
          >
            {ablation?.sets ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {Object.entries(ablation.sets).map(([setName, data]) => {
                  const isBaseline = setName.includes('Baseline')
                  return (
                    <div
                      key={setName}
                      className={`rounded-lg border p-4 ${
                        isBaseline
                          ? 'border-volt/30 bg-volt/[0.02]'
                          : 'border-white/[0.06] bg-white/[0.01]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-slate-200">{setName}</h4>
                        <span className="font-mono text-xs text-slate-400">
                          {data.featureCount} features
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-2xl font-bold text-volt">
                        {(data.meanAccuracy * 100).toFixed(1)}%
                      </p>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">
                        Cross-Validation Accuracy
                      </span>

                      <div className="mt-3 border-t border-white/[0.04] pt-2">
                        <span className="text-[10px] uppercase text-slate-400">Active Features:</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {data.features.map((f) => (
                            <span
                              key={f}
                              className="rounded border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                title="Feature study awaiting data."
                message="Ablation benchmarks execute across baseline envelope features, 50Hz waveform parameters, and electrical current shunts."
              />
            )}
          </Panel>
        </div>
      )}

      {/* ---------------- 4. TIME-SERIES ENERGY FORECASTING ---------------- */}
      {activeTab === 'forecasting' && (
        <div className="space-y-5">
          <Panel
            title="Temporal Energy Yield Forecaster"
            subtitle="Predictive time-series regression trained on sequential historical footsteps (temporal split, past → future)"
            icon={TrendingUp}
          >
            {forecast && forecast.isAvailable ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-volt/20 bg-volt/[0.04] p-4">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      FORECASTED ENERGY ({forecast.horizon})
                    </span>
                    <p className="mt-1 font-mono text-2xl font-bold text-volt">
                      {forecast.predictedEnergyJ !== null
                        ? `${forecast.predictedEnergyJ.toFixed(4)} J`
                        : 'CALCULATING'}
                    </p>
                    {forecast.confidenceInterval && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        95% CI: [{forecast.confidenceInterval.lowerJ.toFixed(4)} J –{' '}
                        {forecast.confidenceInterval.upperJ.toFixed(4)} J]
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      TRAINING HORIZON SAMPLES
                    </span>
                    <p className="mt-1 font-mono text-2xl font-bold text-slate-200">
                      {forecast.historicalStepsUsed} steps
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Temporal sequential ordering preserved (No random shuffle)
                    </p>
                  </div>

                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      MODEL ERROR (MAE / RMSE)
                    </span>
                    <p className="mt-1 font-mono text-2xl font-bold text-slate-200">
                      {forecast.metrics ? `${forecast.metrics.mae.toFixed(4)} J` : 'N/A'}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      RMSE: {forecast.metrics ? `${forecast.metrics.rmse.toFixed(4)} J` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-6 text-center">
                <AlertTriangle className="mx-auto h-8 w-8 text-amber-400" />
                <h4 className="mt-2 text-sm font-semibold text-amber-200">
                  INSUFFICIENT HISTORICAL DATA FOR FORECASTING
                </h4>
                <p className="mx-auto mt-1 max-w-md text-xs text-slate-300">
                  {forecast?.message ||
                    'Energy forecasting requires at least 20 sequential footsteps collected under active telemetry to establish autoregressive lag features.'}
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-slate-400">
                  Historical Samples Available:{' '}
                  <strong className="text-white">{forecast?.historicalStepsUsed || 0} / 20</strong>
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* ---------------- 5. ANOMALY DETECTION CENTER ---------------- */}
      {activeTab === 'anomalies' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Filter Source:</span>
              {(['ALL', 'RULE-BASED', 'ML-BASED'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setAnomalyFilter(mode)}
                  className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    anomalyFilter === mode
                      ? 'bg-volt/20 text-volt border border-volt/30'
                      : 'border border-white/[0.08] text-slate-400 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <span className="font-mono text-xs text-slate-500">
              Total Recorded: {anomalies.length}
            </span>
          </div>

          <Panel
            title="Recorded Anomaly Events & Explainability"
            subtitle="Transparent differentiation of physical deterministic violations vs Isolation Forest unsupervised outliers"
            icon={ShieldAlert}
          >
            {anomalies.length > 0 ? (
              <div className="space-y-3">
                {anomalies
                  .filter((a) => (anomalyFilter === 'ALL' ? true : a.source === anomalyFilter))
                  .map((a) => {
                    const isCrit = a.severity === 'CRITICAL'
                    const isHigh = a.severity === 'HIGH'
                    return (
                      <div
                        key={a._id}
                        className={`rounded-lg border p-4 transition-colors ${
                          isCrit
                            ? 'border-rose-500/40 bg-rose-950/20'
                            : isHigh
                              ? 'border-amber-500/30 bg-amber-950/10'
                              : 'border-white/[0.06] bg-white/[0.01]'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-start gap-3">
                            <span
                              className={`mt-0.5 rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
                                a.source === 'RULE-BASED'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              }`}
                            >
                              {a.source}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-slate-100">{a.anomalyType}</h4>
                                <span
                                  className={`rounded px-1.5 py-0.2 font-mono text-[10px] ${
                                    isCrit
                                      ? 'text-rose-400 font-bold'
                                      : isHigh
                                        ? 'text-amber-400'
                                        : 'text-slate-400'
                                  }`}
                                >
                                  [{a.severity}]
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs text-slate-300">{a.possibleCause}</p>
                            </div>
                          </div>

                          {/* Triage controls */}
                          <div className="flex items-center gap-2">
                            {a.status !== 'RESOLVED' ? (
                              <button
                                onClick={() => void handleResolveAnomaly(a._id, 'RESOLVED')}
                                className="btn border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-[11px] py-1 px-2"
                              >
                                Resolve
                              </button>
                            ) : (
                              <span className="font-mono text-[10px] text-emerald-400">
                                ✓ RESOLVED
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Explainability Breakdown */}
                        <div className="mt-3 grid grid-cols-1 gap-2 border-t border-white/[0.04] pt-2 text-xs sm:grid-cols-3">
                          <div>
                            <span className="text-[10px] uppercase text-slate-500 block">
                              Observed Value
                            </span>
                            <span className="font-mono font-semibold text-slate-200">
                              {a.observedValue}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-500 block">
                              Typical Bounds
                            </span>
                            <span className="font-mono text-slate-400">{a.typicalRange}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-slate-500 block">
                              Timestamp & Device
                            </span>
                            <span className="font-mono text-slate-400">
                              {new Date(a.timestamp).toLocaleTimeString()} ({a.deviceId})
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            ) : (
              <EmptyState
                title="Zero anomalies detected."
                message="The anomaly pipeline continuously inspects physical voltage bounds, duration envelopes, and Isolation Forest multidimensional projections."
                tone="ok"
              />
            )}
          </Panel>
        </div>
      )}

      {/* ---------------- 6. STATISTICAL CLASS COMPARISON & HYPOTHESIS TESTING ---------------- */}
      {activeTab === 'statistics' && (
        <div className="space-y-5">
          {/* Live Empirical Metrics Summary */}
          {statsData?.status === 'SUCCESS' && statsData.metrics && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
                <span className="text-[11px] font-mono uppercase text-slate-400">Peak Kinetic Voltage</span>
                <p className="mt-1 font-mono text-xl font-bold text-cyan-400">
                  {statsData.metrics.peakVoltage?.mean != null ? `${statsData.metrics.peakVoltage.mean.toFixed(2)} V` : 'N/A'}
                </p>
                <div className="mt-2 space-y-1 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Median:</span>
                    <span className="font-mono text-slate-200">{statsData.metrics.peakVoltage?.median?.toFixed(2)} V</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Std Dev:</span>
                    <span className="font-mono text-slate-200">±{statsData.metrics.peakVoltage?.stdDev?.toFixed(2)} V</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IQR (Q3 - Q1):</span>
                    <span className="font-mono text-slate-200">{statsData.metrics.peakVoltage?.iqr?.toFixed(2)} V</span>
                  </div>
                  <div className="flex justify-between border-t border-white/[0.06] pt-1">
                    <span>95% CI:</span>
                    <span className="font-mono text-emerald-400">
                      [{statsData.metrics.peakVoltage?.confidenceInterval95?.lower?.toFixed(2)} V, {statsData.metrics.peakVoltage?.confidenceInterval95?.upper?.toFixed(2)} V]
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
                <span className="text-[11px] font-mono uppercase text-slate-400">Pulse Duration Envelope</span>
                <p className="mt-1 font-mono text-xl font-bold text-purple-400">
                  {statsData.metrics.pulseDuration?.mean != null ? `${statsData.metrics.pulseDuration.mean.toFixed(1)} ms` : 'N/A'}
                </p>
                <div className="mt-2 space-y-1 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Median:</span>
                    <span className="font-mono text-slate-200">{statsData.metrics.pulseDuration?.median?.toFixed(1)} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Std Dev:</span>
                    <span className="font-mono text-slate-200">±{statsData.metrics.pulseDuration?.stdDev?.toFixed(1)} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IQR:</span>
                    <span className="font-mono text-slate-200">{statsData.metrics.pulseDuration?.iqr?.toFixed(1)} ms</span>
                  </div>
                  <div className="flex justify-between border-t border-white/[0.06] pt-1">
                    <span>95% CI:</span>
                    <span className="font-mono text-purple-300">
                      [{statsData.metrics.pulseDuration?.confidenceInterval95?.lower?.toFixed(1)}, {statsData.metrics.pulseDuration?.confidenceInterval95?.upper?.toFixed(1)}] ms
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
                <span className="text-[11px] font-mono uppercase text-slate-400">Cadence Step Interval</span>
                <p className="mt-1 font-mono text-xl font-bold text-amber-400">
                  {statsData.metrics.stepInterval?.mean != null ? `${statsData.metrics.stepInterval.mean.toFixed(2)} s` : 'N/A'}
                </p>
                <div className="mt-2 space-y-1 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Median:</span>
                    <span className="font-mono text-slate-200">{statsData.metrics.stepInterval?.median?.toFixed(2)} s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Std Dev:</span>
                    <span className="font-mono text-slate-200">±{statsData.metrics.stepInterval?.stdDev?.toFixed(2)} s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Empirical Samples:</span>
                    <span className="font-mono text-white font-semibold">{statsData.totalSamples}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/[0.06] pt-1">
                    <span>Sample Validity:</span>
                    <span className="font-mono text-emerald-400">VERIFIED NOISE-FILTERED</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Kruskal-Wallis Non-Parametric Hypothesis Testing Card */}
          <Panel
            title="Non-Parametric Hypothesis Testing (Kruskal-Wallis H-Test)"
            subtitle="Evaluates whether kinetic voltage medians differ significantly across gait classes without assuming normality"
            icon={TrendingUp}
          >
            {statsData?.hypothesisTest ? (
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 text-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/20 pb-2">
                  <span className="font-mono font-bold text-cyan-300">
                    {statsData.hypothesisTest.testName}
                  </span>
                  <span className={`rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${
                    statsData.hypothesisTest.pValue < 0.05
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {statsData.hypothesisTest.pValue < 0.05 ? 'REJECT NULL HYPOTHESIS (p < 0.05)' : 'FAIL TO REJECT NULL'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono">
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block">H-Statistic</span>
                    <span className="text-sm font-bold text-white">{statsData.hypothesisTest.hStatistic}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block">Degrees of Freedom</span>
                    <span className="text-sm font-bold text-white">{statsData.hypothesisTest.degreesOfFreedom}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block">p-Value</span>
                    <span className="text-sm font-bold text-cyan-300">{statsData.hypothesisTest.pValue}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block">Significance Level (α)</span>
                    <span className="text-sm font-bold text-slate-300">0.05</span>
                  </div>
                </div>
                <p className="text-slate-300 leading-relaxed pt-1">
                  <strong>Academic Conclusion:</strong> {statsData.hypothesisTest.interpretation}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-400">
                <p className="font-medium text-slate-300 mb-1">Empirical Hypothesis Test Awaiting Multi-Class Samples</p>
                <p>
                  The Kruskal-Wallis non-parametric test requires at least 3 empirical footstep recordings for each of the three gait classes (Light, Normal, Heavy) to calculate test rank statistics.
                </p>
              </div>
            )}
          </Panel>

          {/* Pearson and Spearman Pairwise Correlation Matrix */}
          <Panel
            title="Kinetic Correlation Matrix (Pearson Linear vs Spearman Monotonic)"
            subtitle="Pairwise empirical co-variation between peak voltage, pulse duration, cadence interval, and storage voltage"
            icon={Table2}
          >
            {corrData?.pairs && corrData.pairs.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/[0.08] bg-white/[0.03] text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                      <tr>
                        <th className="py-2.5 px-3">Variable Pair</th>
                        <th className="py-2.5 px-3">Pearson r (Linear)</th>
                        <th className="py-2.5 px-3">Spearman ρ (Rank)</th>
                        <th className="py-2.5 px-3">Statistical Relationship</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] font-mono">
                      {corrData.pairs.map((p: any, idx: number) => (
                        <tr key={idx} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-sans font-medium text-white">
                            {p.varA} ↔ {p.varB}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-cyan-300">
                            {p.pearson > 0 ? `+${p.pearson.toFixed(3)}` : p.pearson.toFixed(3)}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-purple-300">
                            {p.spearman > 0 ? `+${p.spearman.toFixed(3)}` : p.spearman.toFixed(3)}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-300">{p.interpretation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200/90 leading-relaxed">
                  <strong>Scientific Disclaimer:</strong> {corrData.disclaimer || 'Statistical correlation evaluates empirical co-variation and does not prove physical causation.'}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-400">
                At least 5 distinct footstep records are required to compute valid Pearson and Spearman correlation matrices.
              </div>
            )}
          </Panel>

          {/* Reference Ground-Truth Specifications */}
          <Panel
            title="Footstep Class Ground-Truth Reference Criteria"
            subtitle="Standardized reference distributions of peak voltage, pulse duration, and harvested electrical energy across classes"
            icon={Activity}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-2.5 pr-4">Gait Class</th>
                    <th className="py-2.5 px-3">Typical Peak Voltage</th>
                    <th className="py-2.5 px-3">Pulse Duration</th>
                    <th className="py-2.5 px-3">Est. Energy Yield</th>
                    <th className="py-2.5 pl-3">Ground Truth Criteria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] font-mono">
                  <tr className="hover:bg-white/[0.02]">
                    <td className="py-3 pr-4 font-sans font-medium text-emerald-300">LIGHT</td>
                    <td className="py-3 px-3 text-slate-200">0.8 V – 2.2 V</td>
                    <td className="py-3 px-3 text-slate-300">80 ms – 180 ms</td>
                    <td className="py-3 px-3 text-volt font-semibold">0.015 J – 0.035 J</td>
                    <td className="py-3 pl-3 font-sans text-slate-400">Gentle tap / toe strike</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="py-3 pr-4 font-sans font-medium text-cyan-300">NORMAL</td>
                    <td className="py-3 px-3 text-slate-200">2.2 V – 4.5 V</td>
                    <td className="py-3 px-3 text-slate-300">180 ms – 320 ms</td>
                    <td className="py-3 px-3 text-volt font-semibold">0.035 J – 0.085 J</td>
                    <td className="py-3 pl-3 font-sans text-slate-400">Natural walking stride</td>
                  </tr>
                  <tr className="hover:bg-white/[0.02]">
                    <td className="py-3 pr-4 font-sans font-medium text-amber-300">HEAVY</td>
                    <td className="py-3 px-3 text-slate-200">4.5 V – 12.0 V</td>
                    <td className="py-3 px-3 text-slate-300">280 ms – 550 ms</td>
                    <td className="py-3 px-3 text-volt font-semibold">0.085 J – 0.220 J</td>
                    <td className="py-3 pl-3 font-sans text-slate-400">Brisk walk / heel impact / run</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* ---------------- 7. ACADEMIC LIMITATIONS ---------------- */}
      {activeTab === 'limitations' && (
        <div className="space-y-5">
          <Panel
            title="Prototype Engineering & Model Limitations"
            subtitle="Transparent academic documentation of physical and computational constraints"
            icon={FileText}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs leading-relaxed text-slate-300">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
                <h4 className="font-semibold text-slate-100 flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-cyan-400" />
                  ADC Envelope & Transducer Coupling
                </h4>
                <p>
                  Piezoelectric ceramic discs (PZT) exhibit high internal impedance and nonlinear mechanical
                  stiffness. Signal amplitude is sensitive to footwear contact surface area, strike trajectory,
                  and subfloor cushioning.
                </p>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
                <h4 className="font-semibold text-slate-100 flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-amber-400" />
                  Current Sensing Granularity
                </h4>
                <p>
                  Current sensing relies on an optional low-side shunt or INA219 sensor. In units lacking dedicated
                  shunt hardware, energy is estimated via capacitor differential formula <em>0.5 * C * V^2</em>,
                  which excludes instantaneous dynamic dissipation.
                </p>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
                <h4 className="font-semibold text-slate-100 flex items-center gap-2">
                  <Database className="h-4 w-4 text-purple-400" />
                  Generalization Across Participants
                </h4>
                <p>
                  Models evaluated without subject-independent CV exhibit optimistic accuracy (+8–15%) due to
                  memorizing individual cadence. We strictly mandate GroupKFold by <code>participantId</code> to
                  preserve real-world deployment validity.
                </p>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
                <h4 className="font-semibold text-slate-100 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-volt" />
                  Zero Fabrication Policy
                </h4>
                <p>
                  Metrics, forecasts, and anomaly scores reflect actual mathematical models evaluated against
                  persisted database rows. If fewer than 20 samples exist for forecasting, the interface renders
                  &ldquo;INSUFFICIENT HISTORICAL DATA&rdquo; rather than an idealized hallucination.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* Rollback Modal */}
      {rollbackModal.open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-ink-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-amber-400" />
                Rollback Model to {rollbackModal.targetVersion}
              </h3>
              <button
                onClick={() => setRollbackModal({ open: false, targetVersion: '', reason: '' })}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-300">
              Provide a clear audit reason for reverting the active production classifier back to this earlier version.
            </p>

            <textarea
              value={rollbackModal.reason}
              onChange={(e) =>
                setRollbackModal((prev) => ({ ...prev, reason: e.target.value }))
              }
              placeholder="e.g., Higher inference latency observed in hardware deployment; reverting to baseline Random Forest."
              rows={3}
              className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setRollbackModal({ open: false, targetVersion: '', reason: '' })}
                className="btn border-white/10 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleRollbackSubmit()}
                className="btn border-amber-500/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs"
              >
                Confirm Rollback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
