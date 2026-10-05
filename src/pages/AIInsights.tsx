import { BrainCircuit, ShieldAlert, Workflow } from 'lucide-react'
import { useStore } from '../data/store'
import { FilterBar } from '../components/layout'
import aiImg from '../assets/visual-ai-classification.jpg'
import { EmptyState, Panel, StatusBadge, VisualBanner } from '../components/ui'
import { AIClassificationCard, AIInsightCard, AnomalyCard, EnergyScoreCard } from '../components/cards'

const PIPELINE = [
  'Sensor data',
  'Feature extraction',
  'Preprocessing',
  'ML model',
  'Light / Normal / Heavy',
  'Confidence score',
  'Dashboard',
]

export default function AIInsights() {
  const { insights, anomalies, anomalyLevel, settings, stats, model, mlKind } = useStore()
  return (
    <div className="space-y-5">
      <VisualBanner image={aiImg} alt="Three footstep signal signatures separated by a classification model" eyebrow="Light · Normal · Heavy" title="AI Insights" sub="Model output, explainability, system anomaly review and the project performance index." />
      <FilterBar />

      <Panel
        title="Today's AI summary"
        subtitle="Every statement below is generated from the telemetry in range and carries a confidence value."
        icon={BrainCircuit}
      >
        {insights.length === 0 ? (
          <EmptyState title="Not enough data for insights." message="Insights appear once footstep events exist in the selected range." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {insights.map((i) => (
              <AIInsightCard key={i.id} insight={i} />
            ))}
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <AIClassificationCard />
        </div>
        <div className="space-y-5 xl:col-span-5">
          <Panel
            title="Anomaly Detection"
            subtitle="Rule-based detector (rolling z-score on peak voltage, pulse and cadence envelopes) — not an ML anomaly model"
            icon={ShieldAlert}
            actions={
              <StatusBadge tone={anomalyLevel === 'CRITICAL' ? 'crit' : anomalyLevel === 'WARNING' ? 'warn' : 'ok'}>
                {anomalyLevel}
              </StatusBadge>
            }
          >
            {anomalies.length === 0 ? (
              <EmptyState title="No anomalies detected." message="Signal behaviour is within the learned baseline envelope." tone="ok" />
            ) : (
              <div className="space-y-3">
                {anomalies.slice(0, 6).map((a) => (
                  <AnomalyCard key={a.id} anomaly={a} />
                ))}
              </div>
            )}
            <ul className="mt-4 grid grid-cols-1 gap-1.5 border-t border-white/[0.06] pt-3 text-[11px] text-slate-500 sm:grid-cols-2">
              {[
                'Sudden voltage spike',
                'Unexpected voltage drop',
                'Abnormally long step pulse',
                'Repeated noisy signals',
                'Unusually short pulse',
                'Abnormal step interval',
                'ESP32 communication interruption',
                'Storage voltage outside configured range',
              ].map((r) => (
                <li key={r} className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-slate-600" />
                  {r}
                </li>
              ))}
            </ul>
          </Panel>
          <EnergyScoreCard />
        </div>
      </div>

      <Panel title="Machine learning pipeline" subtitle="How a raw pulse becomes a labelled, confidence-scored event" icon={Workflow}>
        <ol className="flex flex-wrap items-center gap-2 text-[11px]">
          {PIPELINE.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-slate-300">{s}</span>
              {i < PIPELINE.length - 1 && <span className="text-slate-600">→</span>}
            </li>
          ))}
        </ol>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ['Model', model.connected ? model.modelName : 'Not connected'],
            ['Prediction source', mlKind === 'api' ? 'ML API' : 'Demo heuristic'],
            ['Classification threshold', settings.classificationThreshold.toFixed(2)],
            ['Confidence threshold', settings.confidenceThreshold.toFixed(2)],
            ['Low-confidence events', `${stats.lowConfidenceCount} in range`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <dt className="label">{k}</dt>
              <dd className="mt-1 font-mono text-sm text-slate-100">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[11px] text-slate-500">
          Predictions are probabilistic. Where confidence falls below the configured threshold the dashboard
          says so rather than presenting the label as fact.
        </p>
      </Panel>
    </div>
  )
}
