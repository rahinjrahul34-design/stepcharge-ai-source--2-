import { useMemo, useState } from 'react'
import {
  Download,
  FlaskConical,
  RefreshCw,
  Table2,
  Database,
  AlertTriangle,
  Trash2,
  PlusCircle,
  GraduationCap,
} from 'lucide-react'
import { useStore } from '../data/store'
import { ML_API_URL } from '../services/ml/mlService'
import { EmptyState, MetricCard, Panel, SectionTitle, StatusBadge, ConfidenceBar } from '../components/ui'
import type { StepClass, StepFeatures } from '../data/types'
import { downloadFile } from '../lib/export'
import { datasetToCsv } from '../services/api/datasetService'

const CLASSES: StepClass[] = ['LIGHT', 'NORMAL', 'HEAVY']
const FEATURE_KEYS: (keyof StepFeatures)[] = [
  'peakVoltage',
  'averageVoltage',
  'pulseDuration',
  'stepInterval',
  'storageVoltage',
]

export default function AIModel() {
  const {
    model,
    modelLoading,
    refreshModel,
    mlKind,
    stats,
    settings,
    dataset: samples,
    addDatasetSample,
    removeDatasetSample,
    lastEvent,
    trainModel,
    training,
    trainError,
    mlHealth,
  } = useStore()
  const [filter, setFilter] = useState<'ALL' | StepClass>('ALL')
  const [participant, setParticipant] = useState('')
  const [capture, setCapture] = useState<string | null>(null)
  const [trained, setTrained] = useState<string | null>(null)

  /** Dataset built from OPERATOR-LABELLED samples collected on this hardware. */
  const dataset = useMemo(() => {
    const rows = samples
    const dist = { LIGHT: 0, NORMAL: 0, HEAVY: 0 } as Record<StepClass, number>
    rows.forEach((r) => (dist[r.label] += 1))
    const min = Math.min(...CLASSES.map((c) => dist[c]))
    const max = Math.max(...CLASSES.map((c) => dist[c]), 1)
    const participants = new Set(rows.map((r) => r.participantId).filter(Boolean) as string[])
    const unlabelled = rows.filter((r) => !r.participantId).length
    return {
      rows,
      dist,
      balance: max ? min / max : 0,
      latest: rows.at(-1) ?? null,
      participants,
      unlabelled,
    }
  }, [samples])

  const visible = useMemo(
    () => (filter === 'ALL' ? dataset.rows : dataset.rows.filter((r) => r.label === filter)).slice().reverse(),
    [dataset.rows, filter],
  )

  /** Labels the most recent captured footstep with operator-supplied ground truth. */
  const label = async (cls: StepClass) => {
    setCapture(null)
    try {
      await addDatasetSample(cls, participant)
      setCapture(
        `Saved one ${cls} sample${participant.trim() ? ` for participant ${participant.trim()}` : ''}.`,
      )
    } catch (e) {
      setCapture((e as Error).message)
    }
  }

  const runTraining = async () => {
    setTrained(null)
    try {
      const meta = await trainModel(datasetToCsv(dataset.rows), `v${Date.now().toString().slice(-6)}`)
      void meta
      setTrained('Training complete — metrics below are from the held-out test split.')
    } catch {
      /* trainError is surfaced from the store */
    }
  }

  const exportDataset = () => downloadFile(`stepcharge-dataset-${Date.now()}.csv`, datasetToCsv(dataset.rows))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle
          title="AI Model"
          sub="Model provenance, performance and the locally collected dataset behind the classifier"
        />
        <button className="btn" onClick={refreshModel} disabled={modelLoading}>
          <RefreshCw className={`h-3.5 w-3.5 ${modelLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {!model.connected && (
        <div className="panel border-amber-400/25 bg-amber-400/[0.06] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <h3 className="text-sm font-semibold text-amber-200">MODEL NOT CONNECTED</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                No trained model is reachable, so no accuracy, precision, recall, F1 or confusion matrix is
                shown — inventing those numbers would misrepresent the project. Classification is currently
                handled by the{' '}
                <span className="font-medium text-amber-200">
                  {mlKind === 'demo' ? 'demo heuristic classifier' : 'configured API (unreachable)'}
                </span>
                , and every predicted label in the UI is tagged accordingly.
              </p>
              <p className="mt-2 font-mono text-[11px] text-slate-500">
                Connect a model: set VITE_ML_API_URL to a scikit-learn service exposing GET /model and POST
                /predict{ML_API_URL ? ` (currently ${ML_API_URL} — not responding)` : ''}.
              </p>
            </div>
          </div>
        </div>
      )}

      <Panel title="Model" icon={FlaskConical}>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Model name', model.connected ? model.modelName : settings.modelName + ' (not connected)'],
            ['Version', model.version],
            ['Last training date', model.trainedAt ? new Date(model.trainedAt).toLocaleString() : 'Not trained'],
            ['Feature count', String(model.featureCount)],
            ['Dataset version', model.datasetVersion ?? 'Not published'],
            ['Classes', model.classes.join(' · ')],
            ['Prediction source', mlKind === 'api' ? 'ML API' : 'Demo heuristic'],
            ['Status', model.connected ? 'Connected' : 'Not connected'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <dt className="label">{k}</dt>
              <dd className="mt-1 break-words font-mono text-xs text-slate-100">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      {/* -------------------------- metrics -------------------------- */}
      {model.metrics && (
        <div
          className={`panel p-4 ${
            model.subjectIndependent ? 'border-emerald-400/25' : 'border-amber-400/25 bg-amber-400/[0.05]'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={model.subjectIndependent ? 'ok' : 'warn'}>
              {model.subjectIndependent ? 'SUBJECT-INDEPENDENT' : 'SUBJECT-DEPENDENT'}
            </StatusBadge>
            <span className="font-mono text-[11px] text-slate-400">
              {model.evaluationMethod ?? 'evaluation method not reported'}
            </span>
            {typeof model.participants === 'number' && model.participants > 0 && (
              <span className="text-[11px] text-slate-500">· {model.participants} participant(s)</span>
            )}
          </div>
          {model.evaluationDetail && (
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{model.evaluationDetail}</p>
          )}
          {!model.subjectIndependent && (
            <p className="mt-2 text-[11px] leading-relaxed text-amber-200">
              These metrics may be optimistic: the same participant's gait can appear in both the
              training and test sets, so the model may be recognising the person rather than the step
              intensity. Report them as subject-dependent.
            </p>
          )}
          {model.warnings && model.warnings.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-white/5 pt-2">
              {model.warnings.map((w) => (
                <li key={w} className="flex gap-2 text-[11px] text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {model.metrics ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Accuracy" value={model.metrics.accuracy * 100} unit="%" decimals={1} provenance="CALCULATED" />
          <MetricCard label="Precision" value={model.metrics.precision * 100} unit="%" decimals={1} provenance="CALCULATED" />
          <MetricCard label="Recall" value={model.metrics.recall * 100} unit="%" decimals={1} provenance="CALCULATED" />
          <MetricCard label="F1 Score" value={model.metrics.f1 * 100} unit="%" decimals={1} provenance="CALCULATED" />
        </div>
      ) : (
        <Panel title="Performance metrics" icon={Table2}>
          <EmptyState
            title="No evaluation metrics available"
            message="Metrics appear here once a trained model reports them from GET /model (or modelMetadata in MongoDB Atlas). The dashboard will not display placeholder accuracy figures."
            tone="warn"
          />
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Confusion matrix" subtitle="Rows = actual class · Columns = predicted class" icon={Table2}>
          {model.confusionMatrix ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-center">
                <thead>
                  <tr>
                    <th className="th text-left">Actual \ Predicted</th>
                    {CLASSES.map((c) => (
                      <th key={c} className="th text-center">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {model.confusionMatrix.map((row, i) => {
                    const total = row.reduce((a, b) => a + b, 0) || 1
                    return (
                      <tr key={i}>
                        <td className="td font-medium text-slate-400">{CLASSES[i]}</td>
                        {row.map((v, j) => (
                          <td key={j} className="td text-center">
                            <span
                              className={`inline-grid h-10 w-full min-w-12 place-items-center rounded font-mono ${
                                i === j ? 'bg-emerald-400/15 text-emerald-300' : v > 0 ? 'bg-rose-400/10 text-rose-300' : 'text-slate-600'
                              }`}
                              style={{ opacity: i === j ? 0.5 + (v / total) * 0.5 : 0.5 + (v / total) * 0.5 }}
                            >
                              {v}
                            </span>
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Confusion matrix unavailable"
              message="Publish it from the training pipeline as modelMetadata.confusionMatrix (3×3, ordered LIGHT, NORMAL, HEAVY)."
            />
          )}
        </Panel>

        <Panel title="Feature importance" subtitle="Reported by the trained model — not estimated by the UI" icon={FlaskConical}>
          {model.featureImportance ? (
            <div className="space-y-3">
              {FEATURE_KEYS.map((k) => (
                <ConfidenceBar key={k} label={k} value={model.featureImportance![k] ?? 0} accent="volt" />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Feature importance unavailable"
              message="Connect the scikit-learn API to expose real importances. The AI Insights page meanwhile shows heuristic contributions, clearly labelled as such."
            />
          )}
        </Panel>
      </div>

      {/* -------------------------- dataset -------------------------- */}
      <Panel
        title="Dataset"
        subtitle="Collected locally from this mat — no internet dataset is used as the primary source"
        icon={Database}
        actions={
          <button className="btn" onClick={exportDataset} disabled={!dataset.rows.length}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Total samples" value={dataset.rows.length} decimals={0} />
          <MetricCard label="Light samples" value={dataset.dist.LIGHT} decimals={0} />
          <MetricCard label="Normal samples" value={dataset.dist.NORMAL} decimals={0} tone="ok" />
          <MetricCard label="Heavy samples" value={dataset.dist.HEAVY} decimals={0} tone="warn" />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="label mb-3">Label distribution &amp; balance</p>
            {CLASSES.map((c) => (
              <div key={c} className="mb-2.5">
                <ConfidenceBar
                  label={`${c} — ${dataset.dist[c]} samples`}
                  value={dataset.rows.length ? dataset.dist[c] / dataset.rows.length : 0}
                  accent={c === 'HEAVY' ? 'warn' : c === 'NORMAL' ? 'ok' : 'volt'}
                />
              </div>
            ))}
            <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3">
              <StatusBadge tone={dataset.balance > 0.6 ? 'ok' : dataset.balance > 0.3 ? 'warn' : 'crit'}>
                Balance {(dataset.balance * 100).toFixed(0)}%
              </StatusBadge>
              <span className="text-[11px] text-slate-500">
                min/max class ratio · below 60% suggests resampling before training
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="label mb-3">Feature columns</p>
            <ul className="space-y-1.5 text-xs">
              {FEATURE_KEYS.map((k) => (
                <li key={k} className="flex justify-between border-b border-white/[0.04] pb-1">
                  <span className="font-mono text-slate-300">{k}</span>
                  <span className="text-slate-500">
                    {k === 'pulseDuration' ? 'ms' : k === 'stepInterval' ? 's' : 'V'} · float
                  </span>
                </li>
              ))}
              <li className="flex justify-between pt-1">
                <span className="font-mono text-slate-300">label</span>
                <span className="text-slate-500">LIGHT | NORMAL | HEAVY</span>
              </li>
            </ul>
            <div className="mt-3 border-t border-white/5 pt-3 text-[11px] text-slate-500">
              <p>
                Dataset status:{' '}
                <span className="text-slate-300">
                  {dataset.rows.length ? `${dataset.rows.length} samples in selected range` : 'No samples in range'}
                </span>
              </p>
              <p className="mt-1">
                Latest sample:{' '}
                <span className="font-mono text-slate-300">
                  {dataset.latest ? new Date(dataset.latest.timestamp).toLocaleString() : '—'}
                </span>
              </p>
              <p className="mt-1">
                Mean confidence in range:{' '}
                <span className="font-mono text-slate-300">{(stats.avgConfidence * 100).toFixed(1)}%</span>
              </p>
            </div>
          </div>
        </div>

        {/* ---------------------- collection controls ---------------------- */}
        <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="label">Collect a labelled sample</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Step on the mat, then tag the captured feature vector with the step type you actually
                performed. This is ground truth — it is never taken from model output.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input w-40 text-xs"
                placeholder="Participant ID"
                value={participant}
                onChange={(e) => setParticipant(e.target.value)}
                title="Who is producing this footstep? Required for subject-independent validation."
              />
              {CLASSES.map((c) => (
                <button
                  key={c}
                  className="btn"
                  onClick={() => void label(c)}
                  disabled={!lastEvent}
                  title={lastEvent ? `Label the last footstep as ${c}` : 'No footstep captured yet'}
                >
                  <PlusCircle className="h-3.5 w-3.5" /> {c}
                </button>
              ))}
            </div>
          </div>
          {lastEvent ? (
            <p className="mt-3 border-t border-white/5 pt-2 font-mono text-[11px] text-slate-400">
              Pending capture · peak {lastEvent.features.peakVoltage.toFixed(2)} V · avg{' '}
              {lastEvent.features.averageVoltage.toFixed(2)} V · {lastEvent.features.pulseDuration} ms · interval{' '}
              {lastEvent.features.stepInterval.toFixed(2)} s
            </p>
          ) : (
            <p className="mt-3 border-t border-white/5 pt-2 text-[11px] text-amber-300">
              No footstep captured yet — no sample can be labelled until the mat registers a step.
            </p>
          )}
          {capture && <p className="mt-2 text-[11px] text-emerald-300">{capture}</p>}
        </div>

        {/* ------------------------- sample table ------------------------- */}
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="label">Collected samples ({visible.length})</p>
            <div className="flex gap-1.5">
              {(['ALL', ...CLASSES] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-2 py-1 text-[11px] ${
                    filter === f ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          {visible.length === 0 ? (
            <EmptyState
              title="No samples collected"
              message="Label a few footsteps above to build the training dataset."
            />
          ) : (
            <div className="max-h-72 overflow-auto rounded-lg border border-white/[0.06]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#0d1117]">
                  <tr>
                    {['Time', 'Peak V', 'Avg V', 'Pulse ms', 'Interval s', 'Label', 'Source', ''].map((h) => (
                      <th key={h} className="th whitespace-nowrap px-2 py-1.5">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id} className="border-t border-white/[0.04]">
                      <td className="td px-2 font-mono text-slate-500">
                        {new Date(r.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="td px-2 font-mono">{r.features.peakVoltage.toFixed(2)}</td>
                      <td className="td px-2 font-mono">{r.features.averageVoltage.toFixed(2)}</td>
                      <td className="td px-2 font-mono">{r.features.pulseDuration}</td>
                      <td className="td px-2 font-mono">{r.features.stepInterval.toFixed(2)}</td>
                      <td className="td px-2">
                        <StatusBadge tone={r.label === 'HEAVY' ? 'warn' : r.label === 'NORMAL' ? 'ok' : 'info'}>
                          {r.label}
                        </StatusBadge>
                      </td>
                      <td className="td px-2 text-slate-500">{r.source}</td>
                      <td className="td px-2">
                        <button
                          onClick={() => void removeDatasetSample(r.id)}
                          className="text-slate-500 hover:text-rose-400"
                          title="Delete this mislabelled sample"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ----------------------- dataset readiness ----------------------- */}
        <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="label mb-2">Dataset readiness for academic claims</p>
          <ul className="space-y-1.5 text-[11px]">
            {CLASSES.map((c) => {
              const n = dataset.dist[c]
              return (
                <li key={c} className="flex items-center justify-between">
                  <span className="text-slate-400">
                    {c}: <span className="font-mono text-slate-200">{n}</span> samples
                  </span>
                  <StatusBadge tone={n >= 150 ? 'ok' : n >= 100 ? 'warn' : 'crit'}>
                    {n >= 150 ? 'GOOD (≥150)' : n >= 100 ? 'MINIMUM (≥100)' : 'INSUFFICIENT (<100)'}
                  </StatusBadge>
                </li>
              )
            })}
            <li className="flex items-center justify-between border-t border-white/5 pt-1.5">
              <span className="text-slate-400">
                Participants labelled:{' '}
                <span className="font-mono text-slate-200">{dataset.participants.size}</span>
                {dataset.unlabelled > 0 && (
                  <span className="text-slate-500"> · {dataset.unlabelled} sample(s) with no participant ID</span>
                )}
              </span>
              <StatusBadge tone={dataset.participants.size >= 5 ? 'ok' : dataset.participants.size >= 2 ? 'warn' : 'crit'}>
                {dataset.participants.size >= 5
                  ? 'SUBJECT-INDEPENDENT READY'
                  : dataset.participants.size >= 2
                    ? 'GROUPED CV POSSIBLE'
                    : 'SUBJECT-DEPENDENT ONLY'}
              </StatusBadge>
            </li>
          </ul>
          <p className="mt-2.5 border-t border-white/5 pt-2 text-[11px] leading-relaxed text-slate-500">
            Without ≥2 participants the trainer can only do a random split, where one person's gait can
            appear in both train and test — accuracy then looks better than it really is. Tag each
            sample with a participant ID to unlock grouped cross-validation.
          </p>
        </div>

        {/* --------------------------- training --------------------------- */}
        <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="label">Train the model</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Sends this dataset to the Python service (POST /train). Requires VITE_ML_API_URL and at
                least 30 samples with ≥5 per class.
              </p>
            </div>
            <button
              className="btn"
              onClick={() => void runTraining()}
              disabled={training || mlKind !== 'api' || !mlHealth?.reachable || dataset.rows.length < 30}
            >
              <GraduationCap className={`h-3.5 w-3.5 ${training ? 'animate-pulse' : ''}`} />
              {training ? 'Training…' : 'Train now'}
            </button>
          </div>
          {mlKind !== 'api' && (
            <p className="mt-2 text-[11px] text-amber-300">
              No ML API configured — training is unavailable from the browser. Run it offline:
              <span className="ml-1 font-mono">python train_model.py --csv stepcharge-dataset.csv</span>
            </p>
          )}
          {trainError && <p className="mt-2 text-[11px] text-rose-300">{trainError}</p>}
          {trained && <p className="mt-2 text-[11px] text-emerald-300">{trained}</p>}
        </div>

        {model.samples && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              ['Total samples (model)', model.samples.total],
              ['Training samples', model.samples.train],
              ['Testing samples', model.samples.test],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="label">{k}</p>
                <p className="mt-1 font-mono text-lg text-slate-100">{Number(v).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
