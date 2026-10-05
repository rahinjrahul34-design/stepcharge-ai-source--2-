import { useState, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  Brush,
} from 'recharts'
import { Maximize2, Minimize2 } from 'lucide-react'
import type { SeriesPoint } from '../data/store'

export const C = {
  volt: '#22d3ee',
  avg: '#60a5fa',
  ok: '#34d399',
  warn: '#f59e0b',
  crit: '#f43f5e',
  violet: '#a78bfa',
  grid: 'rgba(255,255,255,0.05)',
  axis: '#64748b',
}

const axis = { stroke: C.axis, fontSize: 11, tickLine: false, axisLine: false } as const

function TipBox({ label, rows }: { label?: ReactNode; rows: { name: string; value: ReactNode; color: string }[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-ink-900/95 px-3 py-2 shadow-xl backdrop-blur">
      {label !== undefined && <p className="mb-1 text-[11px] font-medium text-slate-400">{label}</p>}
      {rows.map((r) => (
        <p key={r.name} className="flex items-center gap-2 text-xs text-slate-200">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} />
          <span className="text-slate-400">{r.name}</span>
          <span className="ml-auto font-mono">{r.value}</span>
        </p>
      ))}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tooltip = (unit = '', fmtLabel?: (l: any) => string) => ({
  cursor: { stroke: 'rgba(255,255,255,0.12)' },
  content: ({ active, payload, label }: any) =>
    active && payload?.length ? (
      <TipBox
        label={fmtLabel ? fmtLabel(label) : label}
        rows={payload.map((p: any) => ({
          name: p.name,
          value: `${typeof p.value === 'number' ? p.value.toFixed(p.value < 10 ? 3 : 1) : p.value}${unit}`,
          color: p.color || p.fill,
        }))}
      />
    ) : null,
})

/** Expandable chart shell with a fullscreen affordance. */
export function ChartFrame({ children, height = 260 }: { children: ReactNode; height?: number }) {
  const [full, setFull] = useState(false)
  return (
    <div
      className={
        full
          ? 'fixed inset-0 z-50 flex flex-col gap-3 bg-ink-950/97 p-6 backdrop-blur-xl'
          : 'relative'
      }
    >
      <button
        onClick={() => setFull((f) => !f)}
        className="absolute right-0 top-0 z-10 rounded-md border border-white/10 bg-ink-900/70 p-1.5 text-slate-400 transition-colors hover:text-volt"
        title={full ? 'Exit fullscreen' : 'Expand chart'}
      >
        {full ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      </button>
      <div style={{ height: full ? '100%' : height }} className="w-full">
        {children}
      </div>
    </div>
  )
}

const hhmmss = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/* --------------------------- LiveVoltageChart ---------------------------- */
export function LiveVoltageChart({ data, peak, height = 260 }: { data: SeriesPoint[]; peak: number; height?: number }) {
  return (
    <ChartFrame height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="gVolt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.volt} stopOpacity={0.35} />
              <stop offset="100%" stopColor={C.volt} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="t" tickFormatter={hhmmss} {...axis} minTickGap={48} />
          <YAxis domain={[0, 6]} unit="V" {...axis} width={48} />
          <Tooltip {...tooltip(' V', (l) => hhmmss(Number(l)))} />
          <ReferenceLine y={peak} stroke={C.warn} strokeDasharray="4 4" strokeOpacity={0.6} />
          <Area
            type="monotone"
            dataKey="live"
            name="Instantaneous"
            stroke={C.volt}
            strokeWidth={2}
            fill="url(#gVolt)"
            isAnimationActive={false}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="avg"
            name="Average"
            stroke={C.avg}
            strokeWidth={1.4}
            strokeDasharray="3 3"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

/* ------------------------------ StorageChart ----------------------------- */
export function StorageChart({
  data,
  min,
  max,
  height = 200,
}: {
  data: SeriesPoint[]
  min: number
  max: number
  height?: number
}) {
  return (
    <ChartFrame height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="gStore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.ok} stopOpacity={0.3} />
              <stop offset="100%" stopColor={C.ok} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="t" tickFormatter={hhmmss} {...axis} minTickGap={56} />
          <YAxis domain={[0, Math.ceil(max)]} unit="V" {...axis} width={48} />
          <Tooltip {...tooltip(' V', (l) => hhmmss(Number(l)))} />
          <ReferenceLine y={min} stroke={C.warn} strokeDasharray="4 4" strokeOpacity={0.5} />
          <ReferenceLine y={max} stroke={C.crit} strokeDasharray="4 4" strokeOpacity={0.5} />
          <Area
            type="monotone"
            dataKey="storage"
            name="Supercapacitor"
            stroke={C.ok}
            strokeWidth={2}
            fill="url(#gStore)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

/* ------------------------------- Donut ----------------------------------- */
export function FootstepDonut({
  data,
  height = 240,
}: {
  data: { name: string; value: number }[]
  height?: number
}) {
  const colors = [C.volt, C.ok, C.warn]
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={3}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip {...tooltip(' steps')} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-semibold text-white">{total.toLocaleString()}</span>
        <span className="label mt-1">Total steps</span>
      </div>
    </div>
  )
}

/* -------------------- Footstep intensity over time ----------------------- */
export function IntensityChart({
  data,
  height = 260,
}: {
  data: { hour: string; LIGHT: number; NORMAL: number; HEAVY: number }[]
  height?: number
}) {
  return (
    <ChartFrame height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="hour" {...axis} minTickGap={16} />
          <YAxis {...axis} width={44} />
          <Tooltip {...tooltip('')} />
          <Legend wrapperStyle={{ fontSize: 11, color: C.axis }} iconType="circle" iconSize={7} />
          <Bar dataKey="LIGHT" stackId="s" fill={C.volt} radius={[0, 0, 0, 0]} />
          <Bar dataKey="NORMAL" stackId="s" fill={C.ok} />
          <Bar dataKey="HEAVY" stackId="s" fill={C.warn} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

/* ---------------------- Footsteps vs energy scatter ---------------------- */
export function StepsVsEnergyChart({
  data,
  height = 280,
}: {
  data: { steps: number; energy: number }[]
  height?: number
}) {
  return (
    <ChartFrame height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 12, left: -6, bottom: 8 }}>
          <CartesianGrid stroke={C.grid} />
          <XAxis
            type="number"
            dataKey="steps"
            name="Footsteps"
            {...axis}
            label={{ value: 'Footsteps', position: 'insideBottom', offset: -4, fill: C.axis, fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="energy"
            name="Estimated energy"
            unit=" J"
            {...axis}
            width={62}
          />
          <Tooltip {...tooltip('')} />
          <Scatter data={data} fill={C.volt} fillOpacity={0.75} />
          <Line type="monotone" dataKey="energy" stroke={C.violet} dot={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

/* ------------------------- Energy over time ------------------------------ */
export function EnergyOverTimeChart({
  data,
  height = 260,
}: {
  data: { t: string; energy: number; cumulative: number }[]
  height?: number
}) {
  return (
    <ChartFrame height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="t" {...axis} minTickGap={16} />
          <YAxis {...axis} width={56} unit=" J" />
          <Tooltip {...tooltip(' J')} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
          <Bar dataKey="energy" name="Per hour (est.)" fill={C.volt} fillOpacity={0.55} radius={[3, 3, 0, 0]} />
          <Line type="monotone" dataKey="cumulative" name="Cumulative (est.)" stroke={C.ok} strokeWidth={2} dot={false} />
          {data.length > 10 && <Brush dataKey="t" height={18} stroke={C.axis} travellerWidth={8} fill="rgba(255,255,255,0.03)" />}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

/* ---------------------- Voltage distribution ----------------------------- */
export function DistributionChart({
  data,
  height = 240,
}: {
  data: { bin: string; count: number }[]
  height?: number
}) {
  return (
    <ChartFrame height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="bin" {...axis} />
          <YAxis {...axis} width={44} />
          <Tooltip {...tooltip(' steps')} />
          <Bar dataKey="count" name="Steps" radius={[3, 3, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i < 2 ? C.volt : i < 4 ? C.ok : C.warn} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

/* ------------------------ Energy by footstep type ------------------------ */
export function EnergyByTypeChart({
  data,
  height = 240,
}: {
  data: { type: string; energy: number }[]
  height?: number
}) {
  const colors: Record<string, string> = { LIGHT: C.volt, NORMAL: C.ok, HEAVY: C.warn }
  return (
    <ChartFrame height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} horizontal={false} />
          <XAxis type="number" {...axis} unit=" J" />
          <YAxis type="category" dataKey="type" {...axis} width={66} />
          <Tooltip {...tooltip(' J')} />
          <Bar dataKey="energy" name="Estimated energy" radius={[0, 4, 4, 0]} barSize={22}>
            {data.map((d) => (
              <Cell key={d.type} fill={colors[d.type]} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

/* ------------------------------ Mini sparkline --------------------------- */
export function Sparkline({ data, color = C.volt }: { data: { v: number }[]; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.6} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
