import { Footprints, Zap, BarChart3, Scale } from 'lucide-react'
import { useStore } from '../data/store'
import { FilterBar } from '../components/layout'
import { EmptyState, MetricCard, Panel, SectionTitle } from '../components/ui'
import {
  DistributionChart,
  EnergyByTypeChart,
  EnergyOverTimeChart,
  FootstepDonut,
  IntensityChart,
  StepsVsEnergyChart,
} from '../components/charts'
import { AIClassificationCard } from '../components/cards'

export function FootstepAnalytics() {
  const { stats } = useStore()
  const donut = [
    { name: 'LIGHT', value: stats.light },
    { name: 'NORMAL', value: stats.normal },
    { name: 'HEAVY', value: stats.heavy },
  ]
  return (
    <div className="space-y-5">
      <SectionTitle title="Footstep Analytics" sub="Classification mix and intensity over the selected period" />
      <FilterBar />

      {stats.total === 0 ? (
        <EmptyState title="No footstep data available yet." message="Choose a wider date range or wait for the next step event." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <MetricCard
              label="Avg step interval"
              value={stats.avgIntervalS}
              unit="s"
              decimals={2}
              provenance="CALCULATED"
            />
            <MetricCard label="Total steps" value={stats.total} decimals={0} icon={Footprints} delta={stats.deltaPct} provenance="MEASURED" />
            <MetricCard label="Light steps" value={stats.light} decimals={0} sub={<span>{((stats.light / stats.total) * 100).toFixed(1)}% of total</span>} provenance="PREDICTED" />
            <MetricCard label="Normal steps" value={stats.normal} decimals={0} tone="ok" sub={<span>{((stats.normal / stats.total) * 100).toFixed(1)}% of total</span>} provenance="PREDICTED" />
            <MetricCard label="Heavy steps" value={stats.heavy} decimals={0} tone="warn" sub={<span>{((stats.heavy / stats.total) * 100).toFixed(1)}% of total</span>} provenance="PREDICTED" />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="xl:col-span-4">
              <Panel title="Classification mix" icon={Footprints} provenance="PREDICTED">
                <FootstepDonut data={donut} />
                <div className="mt-3 space-y-1.5 text-xs">
                  {donut.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: ['#22d3ee', '#34d399', '#f59e0b'][i] }}
                      />
                      <span className="text-slate-400">{d.name}</span>
                      <span className="ml-auto font-mono text-slate-200">{d.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-slate-500">
                  Mean classifier confidence across the range: {(stats.avgConfidence * 100).toFixed(1)}% ·{' '}
                  {stats.lowConfidenceCount} low-confidence predictions.
                </p>
              </Panel>
            </div>
            <div className="xl:col-span-8">
              <Panel
                title="Footstep Intensity Over Time"
                subtitle="Stacked classification counts per hour"
                icon={BarChart3}
                provenance="PREDICTED"
              >
                <IntensityChart data={stats.byHour} height={300} />
              </Panel>
            </div>
          </div>

          <Panel title="Peak voltage by step type" subtitle="Mean measured peak per predicted class" icon={BarChart3} provenance="MEASURED">
            <div className="grid grid-cols-3 gap-3">
              {stats.energyByType.map((t) => (
                <div key={t.type} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="label">{t.type}</p>
                  <p className="mt-1 font-mono text-xl text-white">{t.avgPeak.toFixed(2)} V</p>
                  <p className="text-[11px] text-slate-500">{t.steps} steps · {(t.energy * 1000).toFixed(1)} mJ est.</p>
                </div>
              ))}
            </div>
          </Panel>

          <AIClassificationCard />
        </>
      )}
    </div>
  )
}

export function EnergyAnalytics() {
  const { stats, settings } = useStore()
  return (
    <div className="space-y-5">
      <SectionTitle
        title="Energy Analytics"
        sub="Measured voltage · calculated power · estimated energy — each clearly separated"
      />
      <FilterBar />

      {stats.total === 0 ? (
        <EmptyState title="No energy data available yet." message="No footstep events fall inside the selected range." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="Estimated energy" value={stats.energyJ} unit="J" decimals={3} icon={Zap} provenance="ESTIMATED" />
            <MetricCard label="Peak voltage" value={stats.peakV} unit="V" tone="warn" provenance="MEASURED" />
            <MetricCard label="Mean peak voltage" value={stats.avgV} unit="V" provenance="CALCULATED" />
            <MetricCard
              label="Energy per step"
              value={stats.total ? (stats.energyJ / stats.total) * 1000 : 0}
              unit="mJ"
              decimals={2}
              provenance="ESTIMATED"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Panel
              title="Footsteps vs Energy Generated"
              subtitle="Cumulative estimated harvest against footstep count"
              icon={Zap}
              provenance="ESTIMATED"
            >
              <StepsVsEnergyChart data={stats.scatter} height={300} />
            </Panel>
            <Panel title="Energy Generation Over Time" subtitle="Hourly and cumulative estimated harvest" icon={BarChart3} provenance="ESTIMATED">
              <EnergyOverTimeChart data={stats.energyOverTime} height={300} />
            </Panel>
            <Panel title="Voltage Output Distribution" subtitle="Histogram of measured peak voltages" icon={BarChart3} provenance="MEASURED">
              <DistributionChart data={stats.distribution} height={260} />
            </Panel>
            <Panel title="Storage Voltage Trend" subtitle="Mean supercapacitor voltage per hour" icon={BarChart3} provenance="MEASURED">
              <EnergyOverTimeChart
                data={stats.storageTrend.map((s) => ({ t: s.t, energy: s.storage, cumulative: s.storage }))}
                height={260}
              />
            </Panel>
            <Panel title="Energy by Footstep Type" subtitle="Estimated harvest grouped by predicted class" icon={Scale} provenance="ESTIMATED">
              <EnergyByTypeChart data={stats.energyByType} height={260} />
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                {stats.energyByType.map((e) => (
                  <div key={e.type} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <p className="label">{e.type}</p>
                    <p className="mt-1 font-mono text-slate-100">{(e.energy * 1000).toFixed(1)} mJ</p>
                    <p className="text-[11px] text-slate-500">{e.steps} steps</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <Panel title="Measurement provenance" subtitle="What this prototype actually measures" icon={Scale}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['Voltage', 'MEASURED', 'ESP32 ADC via resistive divider, post-rectifier.'],
                ['Current', 'NOT MEASURED', 'No shunt or current-sense amplifier is fitted on this build.'],
                ['Power', 'CALCULATED', `P = V²/R_eq with R_eq = 10 kΩ (project-defined).`],
                ['Energy', 'ESTIMATED', `E = ½CV² for storage (C = ${settings.supercapFarads} F); V²/R_eq·t per step.`],
              ].map(([k, tag, note]) => (
                <div key={k} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-100">{k}</p>
                    <span className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                      {tag}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{note}</p>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}
