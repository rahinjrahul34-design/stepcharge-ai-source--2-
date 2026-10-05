import {
  Activity,
  BatteryCharging,
  BrainCircuit,
  Footprints,
  HeartPulse,
  Zap,
  Play,
  RefreshCw,
} from 'lucide-react'
import { SystemArchitecture } from '../components/architecture'
import { useStore } from '../data/store'
import heroImg from '../assets/stepcharge-hero.jpg'
import { FilterBar, type PageKey } from '../components/layout'
import { AnimatedNumber, MetricCard, Panel, PredictionTag, ProvenanceTag, StatusBadge, EmptyState } from '../components/ui'
import { LiveVoltageChart } from '../components/charts'
import {
  ActivityTimeline,
  AIClassificationCard,
  AIInsightCard,
  ElectricalPanel,
  EnergyJourney,
  EnergyScoreCard,
  EnergyStorageCard,
  FootstepDetectedCard,
  LoadStatusCard,
  SystemStatusPanel,
} from '../components/cards'

export default function Overview({ go }: { go: (p: PageKey) => void }) {
  const {
    packet,
    series,
    stats,
    settings,
    insights,
    health,
    simulateStep,
    mode,
    connection,
    connectionError,
    awaitingLiveData,
    retry,
    isStale,
  } = useStore()

  if (connection === 'connecting')
    return <EmptyState title="Connecting…" message="Establishing the telemetry subscription." />

  if (connection === 'error')
    return (
      <EmptyState
        title="Unable to receive live telemetry."
        message={connectionError ?? 'The data source could not be reached.'}
        tone="crit"
        action={
          <button className="btn" onClick={retry}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry connection
          </button>
        }
      />
    )

  // Phase 2: LIVE mode never falls back to demo data. It waits, visibly.
  if (!packet && awaitingLiveData)
    return (
      <div className="space-y-5">
        <SystemStatusPanel />
        <EmptyState
          title="WAITING FOR LIVE DEVICE DATA"
          message="Connected to Node.js backend in LIVE mode, but the ESP32 has not published any telemetry yet. No simulated values will be shown — switch to Demo Mode if you want to explore the dashboard without hardware."
          tone="warn"
          action={
            <button className="btn" onClick={retry}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry connection
            </button>
          }
        />
      </div>
    )

  if (!packet)
    return (
      <EmptyState
        title="ESP32 is offline."
        message="No telemetry has been received yet. Check the device power rail and Wi-Fi credentials."
        tone="crit"
        action={
          <button className="btn" onClick={retry}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry connection
          </button>
        }
      />
    )

  const storagePct = (packet.storage_voltage / settings.storageTargetV) * 100
  const lastUpdate = Math.max(0, Math.round(health.lastDataMs / 1000))

  return (
    <div className="space-y-5">
      {/* --------------------------- PRODUCT INTRO --------------------------- */}
      <section className="hero-intro animate-fadeup">
        <img
          src={heroImg}
          alt="Piezoelectric smart floor tile converting a footstep into stored energy"
          width={1600}
          height={912}
          className="hero-intro__img"
        />
        <div className="hero-intro__veil" />
        <div className="relative max-w-xl p-6 sm:p-10">
          <span className="eyebrow">Footstep → Energy → Storage → AI → Insight</span>
          <h1 className="display mt-4">Turn Every Footstep Into Intelligent Energy.</h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-300 sm:text-[15px]">
            StepCharge AI combines piezoelectric energy harvesting, IoT monitoring, and machine
            learning to transform human footsteps into measurable energy insights.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => go('live')}>
              <Activity className="h-3.5 w-3.5" /> Open live monitoring
            </button>
            <button className="btn" onClick={() => go('ai')}>
              <BrainCircuit className="h-3.5 w-3.5" /> View AI insights
            </button>
          </div>
        </div>
      </section>
      <SystemStatusPanel />
      <SystemArchitecture />
      <FilterBar
        right={
          mode === 'demo' ? (
            <button className="btn btn-primary" onClick={() => simulateStep()}>
              <Play className="h-3.5 w-3.5" /> Simulate footstep
            </button>
          ) : undefined
        }
      />

      {/* ------------------------------- HERO ------------------------------- */}
      <section className="panel relative overflow-hidden p-5 sm:p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(700px 240px at 8% 0%, rgba(34,211,238,0.10), transparent 70%), radial-gradient(500px 220px at 95% 100%, rgba(52,211,153,0.08), transparent 70%)',
          }}
        />
        <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-pulsering rounded-full bg-volt" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-volt" />
              </span>
              <span className="label text-volt">Live sensor</span>
              <StatusBadge tone={mode === 'demo' ? 'warn' : 'ok'}>
                {mode === 'demo' ? 'DEMO MODE' : `LIVE · ${packet.device_id}`}
              </StatusBadge>
              <StatusBadge tone={isStale ? 'warn' : 'ok'} pulse={!isStale}>
                ESP32 {isStale ? 'STALE' : 'ONLINE'}
              </StatusBadge>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Live Footstep Energy Monitor
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
              Real-time monitoring of harvested energy, footstep activity and AI classification.
            </p>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Wi-Fi {health.wifi} · RSSI {packet.wifi_rssi} dBm · last update {lastUpdate}s ago
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3">
                <span className="label">Generated voltage</span>
                <p className="mt-1.5 font-mono text-2xl font-semibold text-volt">
                  <AnimatedNumber value={packet.peak_voltage} /> <span className="text-sm text-slate-500">V</span>
                </p>
                <ProvenanceTag kind="MEASURED" />
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3">
                <span className="label">Storage voltage</span>
                <p className="mt-1.5 font-mono text-2xl font-semibold text-emerald-400">
                  <AnimatedNumber value={packet.storage_voltage} /> <span className="text-sm text-slate-500">V</span>
                </p>
                <ProvenanceTag kind="MEASURED" />
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3">
                <span className="label">Current step</span>
                <p className="mt-1.5 font-mono text-2xl font-semibold text-white">{packet.step_class}</p>
                <PredictionTag source={packet.prediction_source} />
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3">
                <span className="label">System status</span>
                <p className="mt-1.5 font-mono text-2xl font-semibold text-emerald-400">
                  {health.healthScore > 90 ? 'OPTIMAL' : health.healthScore > 70 ? 'STABLE' : 'DEGRADED'}
                </p>
                <ProvenanceTag kind="CALCULATED" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="mb-2 flex items-center justify-between">
              <span className="label">Instantaneous rectified output</span>
              <div className="flex gap-3 text-[11px] text-slate-500">
                <span>
                  Peak <span className="font-mono text-amber-300">{stats.peakV.toFixed(2)} V</span>
                </span>
                <span>
                  Avg <span className="font-mono text-sky-300">{stats.avgV.toFixed(2)} V</span>
                </span>
              </div>
            </div>
            <LiveVoltageChart data={series} peak={stats.peakV} height={280} />
          </div>
        </div>
      </section>

      <EnergyJourney />

      {/* ------------------------------- KPIs ------------------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          label="Total footsteps"
          value={stats.total}
          decimals={0}
          icon={Footprints}
          delta={stats.deltaPct}
          sub={<span>vs previous period</span>}
          provenance="MEASURED"
          onClick={() => go('footsteps')}
        />
        <MetricCard
          label="Peak voltage"
          value={stats.peakV}
          unit="V"
          icon={Zap}
          sub={<span>Now: {packet.peak_voltage.toFixed(2)} V</span>}
          provenance="MEASURED"
          onClick={() => go('live')}
        />
        <MetricCard
          label="Estimated energy"
          value={stats.energyJ}
          unit="J"
          decimals={3}
          icon={Activity}
          sub={<span>Harvest in range</span>}
          provenance="ESTIMATED"
          onClick={() => go('energy')}
        />
        <MetricCard
          label="Storage voltage"
          value={packet.storage_voltage}
          unit="V"
          icon={BatteryCharging}
          tone="ok"
          sub={<span>{storagePct.toFixed(0)}% of configured target</span>}
          progress={storagePct}
          provenance="MEASURED"
        />
        <MetricCard
          label="Current step type"
          value={packet.step_class}
          raw
          icon={BrainCircuit}
          sub={
            <span>
              Confidence: {packet.confidence === null ? 'not available' : `${(packet.confidence * 100).toFixed(0)}%`}
            </span>
          }
          provenance="PREDICTED"
          onClick={() => go('ai')}
        />
        <MetricCard
          label="System health"
          value={health.healthScore}
          unit="%"
          decimals={0}
          icon={HeartPulse}
          tone="ok"
          sub={<span>{health.healthScore > 90 ? 'Healthy' : 'Attention needed'}</span>}
          progress={health.healthScore}
          onClick={() => go('health')}
        />
      </div>

      {/* ----------------------------- MAIN GRID ---------------------------- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-7">
          <FootstepDetectedCard />
          <AIClassificationCard />
          <EnergyStorageCard />
        </div>
        <div className="space-y-5 xl:col-span-5">
          <ActivityTimeline limit={8} />
          <ElectricalPanel />
          <LoadStatusCard />
          <EnergyScoreCard />
        </div>
      </div>

      <Panel
        title="Today's AI summary"
        subtitle="Derived strictly from the telemetry in the selected range — no external assumptions."
        icon={BrainCircuit}
      >
        {insights.length === 0 ? (
          <EmptyState title="No footstep data available yet." message="Insights appear once events exist in range." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {insights.map((i) => (
              <AIInsightCard key={i.id} insight={i} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
