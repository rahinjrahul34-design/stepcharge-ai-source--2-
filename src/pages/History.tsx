import { useMemo, useState } from 'react'
import { ArrowDownUp, Download, FileText, Search } from 'lucide-react'
import { useStore } from '../data/store'
import { FilterBar } from '../components/layout'
import { EmptyState, Panel, PredictionTag, SectionTitle, StatusBadge, classTone, fmtDateTime } from '../components/ui'
import { downloadFile, eventsToCsv } from '../lib/export'

type SortKey = 'timestamp' | 'peak_voltage' | 'storage_voltage' | 'estimated_energy_j' | 'confidence'
const PAGE = 12



/** Sortable header cell — defined at module scope so it is not re-created each render. */
function Th({
  k,
  children,
  sort,
  dir,
  onSort,
}: {
  k?: SortKey
  children: string
  sort: SortKey
  dir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
}) {
  return (
    <th className="th">
      {k ? (
        <button className="inline-flex items-center gap-1 hover:text-slate-300" onClick={() => onSort(k)}>
          {children}
          <ArrowDownUp
            className={`h-3 w-3 transition-transform ${
              sort === k ? `text-volt ${dir === 'asc' ? 'rotate-180' : ''}` : 'text-slate-700'
            }`}
          />
        </button>
      ) : (
        children
      )}
    </th>
  )
}

export default function History() {
  const { history, historyLoading, historyError, stats, settings, range, mode, retry, model } = useStore()
  const [q, setQ] = useState('')
  const [cls, setCls] = useState('ALL')
  const [dev, setDev] = useState('ALL')
  const [vmin, setVmin] = useState('')
  const [vmax, setVmax] = useState('')
  const [sort, setSort] = useState<SortKey>('timestamp')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)

  const deviceOptions = useMemo(
    () => ['ALL', ...Array.from(new Set(history.map((e) => e.device_id)))],
    [history],
  )

  /** Confidence is only meaningful when a real model produced it. */
  const showConfidence = model.connected

  const onSort = (k: SortKey) => {
    setSort(k)
    setDir(sort === k && dir === 'desc' ? 'asc' : 'desc')
  }

  const rows = useMemo(() => {
    const f = history.filter((e) => {
      if (cls !== 'ALL' && e.step_class !== cls) return false
      if (dev !== 'ALL' && e.device_id !== dev) return false
      if (vmin && e.peak_voltage < Number(vmin)) return false
      if (vmax && e.peak_voltage > Number(vmax)) return false
      if (q) {
        const hay = `${e.timestamp} ${e.step_class} ${e.peak_voltage}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
    return f.sort((a, b) => {
      const av = sort === 'timestamp' ? +new Date(a.timestamp) : (a[sort] as number)
      const bv = sort === 'timestamp' ? +new Date(b.timestamp) : (b[sort] as number)
      return dir === 'asc' ? av - bv : bv - av
    })
  }, [history, q, cls, dev, vmin, vmax, sort, dir])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const view = rows.slice(page * PAGE, page * PAGE + PAGE)

  const report = () =>
    downloadFile(
      `stepcharge-report-${range}.md`,
      `# StepCharge AI — Session Report\n\nGenerated: ${new Date().toISOString()}\nDevice: ${settings.deviceId}\nRange: ${range}\nData source: ${mode === 'demo' ? 'DEMO (SIMULATED)' : 'LIVE ESP32'}\n\n## Summary\n- Total footsteps (measured count): ${stats.total}\n- Light / Normal / Heavy (predicted): ${stats.light} / ${stats.normal} / ${stats.heavy}\n- Peak voltage (measured): ${stats.peakV.toFixed(2)} V\n- Mean peak voltage (calculated): ${stats.avgV.toFixed(2)} V\n- Estimated harvested energy: ${stats.energyJ.toFixed(4)} J\n- Mean classifier confidence: ${(stats.avgConfidence * 100).toFixed(1)}%\n\n## Method notes\nVoltage is measured by the ESP32 ADC. Current is not measured on this prototype;\npower is calculated as V²/R_eq and energy is estimated (½CV² for storage,\nV²/R_eq·t per step). No value in this report should be read as a direct energy measurement.\n`,
      'text/markdown',
    )

  return (
    <div className="space-y-5">
      <SectionTitle title="History" sub="Research-grade event log — exportable, no personal data recorded" />
      <FilterBar
        right={
          <>
            <button className="btn" onClick={() =>
                downloadFile(
                  `stepcharge-${range}.csv`,
                  eventsToCsv(rows, { deviceId: settings.deviceId, mode, range }),
                )
              }>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
            <button className="btn" onClick={report}>
              <FileText className="h-3.5 w-3.5" /> Export Report
            </button>
          </>
        }
      />

      <Panel>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
            <input
              className="input pl-9"
              placeholder="Search timestamp, class, voltage…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(0)
              }}
            />
          </label>
          <select className="input" value={dev} onChange={(e) => setDev(e.target.value)}>
            {deviceOptions.map((d) => (
              <option key={d} value={d}>
                {d === 'ALL' ? 'All devices' : d}
              </option>
            ))}
          </select>
          <select className="input" value={cls} onChange={(e) => setCls(e.target.value)}>
            {['ALL', 'LIGHT', 'NORMAL', 'HEAVY', 'UNKNOWN'].map((c) => (
              <option key={c} value={c}>
                {c === 'ALL' ? 'All step types' : c}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Min peak V"
            inputMode="decimal"
            value={vmin}
            onChange={(e) => setVmin(e.target.value)}
          />
          <input
            className="input"
            placeholder="Max peak V"
            inputMode="decimal"
            value={vmax}
            onChange={(e) => setVmax(e.target.value)}
          />
        </div>

        {historyError ? (
          <EmptyState
            title="Unable to load history"
            message={historyError}
            tone="crit"
            action={
              <button className="btn" onClick={retry}>
                Retry connection
              </button>
            }
          />
        ) : historyLoading ? (
          <p className="py-10 text-center text-xs text-slate-500">Loading telemetry…</p>
        ) : rows.length === 0 ? (
          <EmptyState title="No records match these filters." message="Relax the voltage range or pick a wider date window." />
        ) : (
          <>
            <div className="-mx-4 overflow-x-auto sm:mx-0">
              <table className="min-w-full">
                <thead className="border-b border-white/[0.06]">
                  <tr>
                    <Th k="timestamp" sort={sort} dir={dir} onSort={onSort}>Timestamp</Th>
                    <Th sort={sort} dir={dir} onSort={onSort}>Steps</Th>
                    <Th k="peak_voltage" sort={sort} dir={dir} onSort={onSort}>Peak V</Th>
                    <Th sort={sort} dir={dir} onSort={onSort}>Avg V</Th>
                    <Th k="storage_voltage" sort={sort} dir={dir} onSort={onSort}>Storage V</Th>
                    <Th k="estimated_energy_j" sort={sort} dir={dir} onSort={onSort}>Est. Energy</Th>
                    <Th sort={sort} dir={dir} onSort={onSort}>Step Type</Th>
                    {showConfidence && (
                      <Th k="confidence" sort={sort} dir={dir} onSort={onSort}>
                        Confidence
                      </Th>
                    )}
                    <Th sort={sort} dir={dir} onSort={onSort}>Source</Th>
                    <Th sort={sort} dir={dir} onSort={onSort}>Device</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {view.map((r, i) => (
                    <tr key={r.id} className="transition-colors hover:bg-white/[0.025]">
                      <td className="td font-mono text-xs text-slate-400">{fmtDateTime(r.timestamp)}</td>
                      <td className="td font-mono">{page * PAGE + i + 1}</td>
                      <td className="td font-mono text-volt">{r.peak_voltage.toFixed(2)}</td>
                      <td className="td font-mono text-slate-400">{r.features.averageVoltage.toFixed(2)}</td>
                      <td className="td font-mono text-emerald-400">{r.storage_voltage.toFixed(2)}</td>
                      <td className="td font-mono text-amber-300">{(r.estimated_energy_j * 1000).toFixed(2)} mJ</td>
                      <td className="td">
                        <StatusBadge tone={classTone(r.step_class)}>{r.step_class}</StatusBadge>
                      </td>
                      {showConfidence && (
                        <td className="td font-mono">
                          <span
                            className={
                              r.confidence !== null && r.confidence < 0.65 ? 'text-amber-400' : 'text-slate-300'
                            }
                          >
                            {r.confidence === null ? '—' : `${(r.confidence * 100).toFixed(0)}%`}
                          </span>
                        </td>
                      )}
                      <td className="td">
                        <PredictionTag source={r.prediction_source} />
                      </td>
                      <td className="td font-mono text-[11px] text-slate-500">{r.device_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3 text-xs text-slate-500">
              <span>
                Showing {page * PAGE + 1}–{Math.min(rows.length, (page + 1) * PAGE)} of {rows.length.toLocaleString()}
              </span>
              <div className="flex items-center gap-1.5">
                <button className="btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <span className="px-2 font-mono">
                  {page + 1} / {pages}
                </span>
                <button className="btn" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}
