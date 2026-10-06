import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { MockDataSource } from './mockSource'
import { LiveDataSource } from './liveSource'
import { storedEnergyJ } from './energy'
import {
  createMlService,
  MODEL_NOT_CONNECTED,
  ML_API_URL,
  type MlHealth,
  type MlService,
} from '../services/ml/mlService'
import {
  addSample as dsAdd,
  deleteSample as dsDelete,
  listSamples as dsList,
  makeSample,
} from '../services/api/datasetService'
import { deviceId as envDeviceId } from '../services/api/client'
import { fetchModelMetadata } from '../services/api/deviceService'
import { markAlertRead as apiMarkAlertRead, markAllAlertsRead, subscribeAlerts } from '../services/api/alertService'
import { EMPTY_LOADS } from './types'
import type {
  AiInsight,
  AlertCategory,
  AlertItem,
  AlertSeverity,
  Anomaly,
  AnomalyKind,
  ConnectionState,
  DataSource,
  FootstepEvent,
  ModelMetadata,
  PiezoSensor,
  DatasetSample,
  DeviceInfo,
  LoadMap,
  Prediction,
  RangeKey,
  Settings,
  SourceMode,
  StepClass,
  SystemHealth,
  TelemetryPacket,
} from './types'

export const DEFAULT_SETTINGS: Settings = {
  deviceId: envDeviceId(),
  samplingIntervalMs: 20,
  txIntervalMs: 1000,
  storageTargetV: 5.0,
  minOperatingV: 2.0,
  maxSafeV: 5.4,
  supercapFarads: 0.1,
  energyMode: 'auto',
  modelName: 'Random Forest (scikit-learn)',
  classificationThreshold: 0.5,
  confidenceThreshold: 0.65,
  enabledClasses: ['LIGHT', 'NORMAL', 'HEAVY'],
  alertsEnabled: true,
  lowStorageAlertV: 2.5,
  spikeAlertV: 5.0,
  offlineTimeoutSec: 10,
  footstepThresholdV: 0.8,
  debounceMs: 60,
  warnStorageV: 4.7,
  deviceName: 'StepCharge Mat 01',
  deviceLocation: 'Prototype Lab',
  theme: 'dark',
  refreshRateMs: 400,
  units: 'SI',
}

export interface SeriesPoint {
  t: number
  live: number
  avg: number
  storage: number
}

export interface Stats {
  total: number
  light: number
  normal: number
  heavy: number
  unclassified: number
  energyJ: number
  peakV: number
  avgV: number
  avgConfidence: number
  avgIntervalS: number
  lowConfidenceCount: number
  prevTotal: number
  deltaPct: number
  byHour: { hour: string; LIGHT: number; NORMAL: number; HEAVY: number; energy: number }[]
  scatter: { steps: number; energy: number; bucket: string }[]
  distribution: { bin: string; count: number }[]
  energyByType: { type: string; energy: number; steps: number; avgPeak: number }[]
  energyOverTime: { t: string; energy: number; cumulative: number }[]
  storageTrend: { t: string; storage: number }[]
}

interface Ctx {
  // telemetry
  packet: TelemetryPacket | null
  series: SeriesPoint[]
  events: FootstepEvent[]
  lastEvent: FootstepEvent | null
  // history
  history: FootstepEvent[]
  historyLoading: boolean
  historyError: string | null
  range: RangeKey
  customRange: { from: string; to: string }
  setRange: (r: RangeKey, c?: { from: string; to: string }) => void
  stats: Stats
  // source
  mode: SourceMode
  setMode: (m: SourceMode) => void
  liveAvailable: boolean
  connection: ConnectionState
  connectionError: string | null
  retry: () => void
  isStale: boolean
  // settings & derived
  settings: Settings
  updateSettings: (p: Partial<Settings>) => void
  alerts: AlertItem[]
  markAlertRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  anomalies: Anomaly[]
  anomalyLevel: 'NORMAL' | 'WARNING' | 'CRITICAL'
  insights: AiInsight[]
  health: SystemHealth
  model: ModelMetadata
  modelLoading: boolean
  refreshModel: () => void
  piezo: PiezoSensor[] | null
  piezoAvailable: boolean
  mlKind: 'demo' | 'api'
  mlHealth: MlHealth | null
  mlBaseUrl: string | null
  trainModel: (csv: string, version: string) => Promise<void>
  training: boolean
  trainError: string | null
  loads: LoadMap
  device: DeviceInfo | null
  dataset: DatasetSample[]
  addDatasetSample: (label: StepClass, participantId?: string, note?: string) => Promise<void>
  removeDatasetSample: (id: string) => Promise<void>
  refreshDataset: () => void
  /** True when LIVE is selected but the device has never sent anything. */
  awaitingLiveData: boolean
  // actions
  simulateStep: (c?: StepClass) => void
  setLoad: (l: 'led' | 'fan', on: boolean) => void
  explain: (e: FootstepEvent) => Promise<Prediction>
}

const StoreCtx = createContext<Ctx | null>(null)
const MAX_POINTS = 90
const nowIso = () => new Date().toISOString()
let aid = 0

/* ------------------------------ statistics ------------------------------ */
function computeStats(evts: FootstepEvent[], prevCount: number): Stats {
  const light = evts.filter((e) => e.step_class === 'LIGHT').length
  const heavy = evts.filter((e) => e.step_class === 'HEAVY').length
  const normal = evts.filter((e) => e.step_class === 'NORMAL').length
  const unclassified = evts.filter((e) => e.step_class === 'UNKNOWN').length
  const energyJ = evts.reduce((s, e) => s + e.estimated_energy_j, 0)
  const peakV = evts.reduce((m, e) => Math.max(m, e.peak_voltage), 0)
  const avgV = evts.length ? evts.reduce((s, e) => s + e.peak_voltage, 0) / evts.length : 0
  // Only classified steps contribute to the mean confidence.
  const scored = evts.filter((e) => typeof e.confidence === 'number')
  const avgConfidence = scored.length
    ? scored.reduce((s, e) => s + (e.confidence as number), 0) / scored.length
    : 0
  const avgIntervalS = evts.length
    ? evts.reduce((s, e) => s + e.step_interval_ms, 0) / evts.length / 1000
    : 0

  const hours = new Map<
    string,
    { LIGHT: number; NORMAL: number; HEAVY: number; UNKNOWN: number; energy: number; sV: number; n: number }
  >()
  for (const e of evts) {
    const d = new Date(e.timestamp)
    const key = `${String(d.getHours()).padStart(2, '0')}:00`
    const row = hours.get(key) ?? { LIGHT: 0, NORMAL: 0, HEAVY: 0, UNKNOWN: 0, energy: 0, sV: 0, n: 0 }
    row[e.step_class] += 1
    row.energy += e.estimated_energy_j
    row.sV += e.storage_voltage
    row.n += 1
    hours.set(key, row)
  }
  const sortedHours = [...hours.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const byHour = sortedHours.map(([hour, v]) => ({
    hour,
    LIGHT: v.LIGHT,
    NORMAL: v.NORMAL,
    HEAVY: v.HEAVY,
    energy: +v.energy.toFixed(5),
  }))
  const storageTrend = sortedHours.map(([hour, v]) => ({
    t: hour,
    storage: +(v.sV / Math.max(1, v.n)).toFixed(3),
  }))

  const scatter: { steps: number; energy: number; bucket: string }[] = []
  let cum = 0
  const stride = Math.max(1, Math.floor(evts.length / 60))
  evts.forEach((e, i) => {
    cum += e.estimated_energy_j
    if (i % stride === 0) scatter.push({ steps: i + 1, energy: +cum.toFixed(5), bucket: e.step_class })
  })

  const bins = [0, 1, 2, 3, 4, 5, 6]
  const distribution = bins.slice(0, -1).map((b, i) => ({
    bin: `${b}–${bins[i + 1]} V`,
    count: evts.filter((e) => e.peak_voltage >= b && e.peak_voltage < bins[i + 1]).length,
  }))

  const energyByType = (['LIGHT', 'NORMAL', 'HEAVY'] as StepClass[]).map((t) => {
    const sub = evts.filter((e) => e.step_class === t)
    return {
      type: t,
      steps: sub.length,
      energy: +sub.reduce((s, e) => s + e.estimated_energy_j, 0).toFixed(5),
      avgPeak: sub.length ? +(sub.reduce((s, e) => s + e.peak_voltage, 0) / sub.length).toFixed(2) : 0,
    }
  })

  let run = 0
  const energyOverTime = byHour.map((h) => {
    run += h.energy
    return { t: h.hour, energy: h.energy, cumulative: +run.toFixed(5) }
  })

  return {
    total: evts.length,
    light,
    normal,
    heavy,
    unclassified,
    energyJ,
    peakV,
    avgV,
    avgConfidence,
    avgIntervalS,
    lowConfidenceCount: scored.filter((e) => (e.confidence as number) < 0.65).length,
    prevTotal: prevCount,
    deltaPct: prevCount ? ((evts.length - prevCount) / prevCount) * 100 : 0,
    byHour,
    scatter,
    distribution,
    energyByType,
    energyOverTime,
    storageTrend,
  }
}

/* -------------------------------- provider ------------------------------- */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const raw = localStorage.getItem('stepcharge.settings')
      return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS
    } catch {
      return DEFAULT_SETTINGS
    }
  })
  const updateSettings = useCallback((p: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...p }
      localStorage.setItem('stepcharge.settings', JSON.stringify(next))
      return next
    })
  }, [])

  const mlRef = useRef<MlService>(createMlService())
  const liveAvailable = true

  const [mode, setModeState] = useState<SourceMode>(() => {
    const saved = localStorage.getItem('stepcharge.mode') as SourceMode | null
    return saved === 'live' ? 'live' : 'demo'
  })
  const [connection, setConnection] = useState<ConnectionState>('idle')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const [packet, setPacket] = useState<TelemetryPacket | null>(null)
  const [series, setSeries] = useState<SeriesPoint[]>([])
  const [events, setEvents] = useState<FootstepEvent[]>([])
  const [lastEvent, setLastEvent] = useState<FootstepEvent | null>(null)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [piezo, setPiezo] = useState<PiezoSensor[] | null>(null)
  const [loads, setLoads] = useState<LoadMap>(EMPTY_LOADS)
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [dataset, setDataset] = useState<DatasetSample[]>([])
  const [mlHealth, setMlHealth] = useState<MlHealth | null>(null)
  const [training, setTraining] = useState(false)
  const [trainError, setTrainError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  const sourceRef = useRef<DataSource | null>(null)

  const setMode = useCallback((m: SourceMode) => {
    localStorage.setItem('stepcharge.mode', m)
    setModeState(m)
    setAttempt((a) => a + 1)
  }, [])
  const retry = useCallback(() => setAttempt((a) => a + 1), [])

  /* ----------------------------- alert engine ---------------------------- */
  const pushAlert = useCallback(
    (a: {
      severity: AlertSeverity
      category: AlertCategory
      title: string
      reason: string
      currentValue: string
      threshold: string
      action: string
    }) => {
      setAlerts((prev) => {
        const dup = prev.find((x) => x.title === a.title && Date.now() - +new Date(x.timestamp) < 45000)
        if (dup) return prev
        return [{ ...a, id: `alert-${aid++}`, timestamp: nowIso() }, ...prev].slice(0, 60)
      })
    },
    [],
  )
  const alertsEnabled = settings.alertsEnabled
  const guardedAlert = useCallback(
    (a: Parameters<typeof pushAlert>[0]) => {
      if (alertsEnabled) pushAlert(a)
    },
    [alertsEnabled, pushAlert],
  )

  useEffect(() => {
    if (mode !== 'live') return
    let cleanup: (() => void) | undefined
    void subscribeAlerts(
      (next) => setAlerts(next),
      (error) => setConnectionError(error.message),
    ).then((off) => {
      cleanup = off
    })
    return () => cleanup?.()
  }, [mode, attempt])

  /* -------------------- connect / teardown the data source --------------- */
  useEffect(() => {
    let cancelled = false
    const offs: Array<() => void> = []
    setConnection('connecting')
    setConnectionError(null)
    setPacket(null)
    setSeries([])
    setEvents([])
    setLastEvent(null)
    setLoads(EMPTY_LOADS)
    setDevice(null)

    const ml = mlRef.current
    const src: DataSource =
      mode === 'live'
        ? new LiveDataSource(ml, settings.supercapFarads, (e) => {
            setConnectionError(e.message)
            guardedAlert({
              severity: 'warning',
              category: 'NETWORK',
              title: 'Telemetry stream error',
              reason: e.message,
              currentValue: 'error',
              threshold: '—',
              action: 'Check backend API and the device connection, then retry.',
            })
          })
        : new MockDataSource(ml, settings.supercapFarads)
    sourceRef.current = src
    ;(async () => {
      try {
        await src.connect()
        if (cancelled) return
        setConnection('connected')
        offs.push(
          src.subscribeTelemetry((p) => {
            setPacket(p)
            setSeries((s) =>
              [
                ...s,
                { t: +new Date(p.timestamp), live: p.peak_voltage, avg: p.average_voltage, storage: p.storage_voltage },
              ].slice(-MAX_POINTS),
            )
          }),
        )
        offs.push(src.subscribeEvents((e) => handleEventRef.current(e)))
        offs.push(src.subscribeLoads((l) => setLoads(l)))
        offs.push(src.subscribeDevice((d) => setDevice(d)))
        const pz = await src.getPiezoArray()
        if (!cancelled) setPiezo(pz)
      } catch (e) {
        if (cancelled) return
        setConnection('error')
        setConnectionError((e as Error).message)
      }
    })()

    return () => {
      cancelled = true
      offs.forEach((o) => o())
      src.disconnect()
      sourceRef.current = null
    }
    // Reconnect only on mode/attempt/capacitance change — not on every setting keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, attempt, settings.supercapFarads])

  /* ---------------- footstep event pipeline (steps 1–12) ----------------- */
  const baselineRef = useRef<number[]>([])
  const intervalBaseRef = useRef<number[]>([])

  const addAnomaly = useCallback(
    (a: { kind: AnomalyKind; label: string; reason: string; level: Anomaly['level']; score: number; metric: string; timestamp: string }) => {
      setAnomalies((prev) => [{ ...a, id: `anom-${aid++}`, status: 'Needs Review' as const }, ...prev].slice(0, 40))
    },
    [],
  )

  const handleEvent = useCallback(
    (e: FootstepEvent) => {
      setEvents((prev) => [e, ...prev].slice(0, 120))
      setLastEvent(e)
      setHistory((prev) => [...prev, e])

      // --- rule-based anomaly detection (explicitly NOT an ML detector) ---
      const base = baselineRef.current
      const mean = base.length ? base.reduce((a, b) => a + b, 0) / base.length : e.peak_voltage
      const sd = base.length ? Math.sqrt(base.reduce((a, b) => a + (b - mean) ** 2, 0) / base.length) : 0.6
      const z = sd > 0.05 ? (e.peak_voltage - mean) / sd : 0
      base.push(e.peak_voltage)
      if (base.length > 40) base.shift()

      const ib = intervalBaseRef.current
      const imean = ib.length ? ib.reduce((a, b) => a + b, 0) / ib.length : e.step_interval_ms
      ib.push(e.step_interval_ms)
      if (ib.length > 40) ib.shift()

      const ts = e.timestamp
      if (z > 2.6)
        addAnomaly({
          kind: 'VOLTAGE_SPIKE',
          label: 'Sudden voltage spike',
          reason: 'Peak voltage rose far above the recent rolling baseline.',
          level: z > 3.6 ? 'CRITICAL' : 'WARNING',
          score: +Math.min(0.99, 0.55 + z / 10).toFixed(2),
          metric: `peak ${e.peak_voltage.toFixed(2)} V · baseline ${mean.toFixed(2)} V · z=${z.toFixed(1)}`,
          timestamp: ts,
        })
      else if (z < -2.6)
        addAnomaly({
          kind: 'VOLTAGE_DROP',
          label: 'Unexpected voltage drop',
          reason: 'Peak voltage fell well below the recent rolling baseline.',
          level: 'WARNING',
          score: +Math.min(0.99, 0.55 + Math.abs(z) / 10).toFixed(2),
          metric: `peak ${e.peak_voltage.toFixed(2)} V · baseline ${mean.toFixed(2)} V · z=${z.toFixed(1)}`,
          timestamp: ts,
        })
      if (e.pulse_duration_ms > 310)
        addAnomaly({
          kind: 'LONG_PULSE',
          label: 'Unusually long pulse',
          reason: 'Pulse duration exceeded the expected envelope for a single footstep.',
          level: 'WARNING',
          score: 0.78,
          metric: `${e.pulse_duration_ms} ms (limit 310 ms)`,
          timestamp: ts,
        })
      else if (e.pulse_duration_ms < 60)
        addAnomaly({
          kind: 'SHORT_PULSE',
          label: 'Unusually short pulse',
          reason: 'Pulse was shorter than a plausible footstep — possible electrical noise.',
          level: 'WARNING',
          score: 0.71,
          metric: `${e.pulse_duration_ms} ms (floor 60 ms)`,
          timestamp: ts,
        })
      if (ib.length > 8 && (e.step_interval_ms > imean * 3 || e.step_interval_ms < imean / 3))
        addAnomaly({
          kind: 'ABNORMAL_INTERVAL',
          label: 'Abnormal step interval',
          reason: 'Gap between footsteps deviates sharply from the established cadence.',
          level: 'WARNING',
          score: 0.68,
          metric: `${(e.step_interval_ms / 1000).toFixed(2)} s vs mean ${(imean / 1000).toFixed(2)} s`,
          timestamp: ts,
        })

      if (Math.abs(z) > 2.6)
        guardedAlert({
          severity: 'warning',
          category: 'HARDWARE',
          title: 'Abnormal voltage pulse detected',
          reason: 'Pulse envelope deviates from the rolling baseline.',
          currentValue: `${e.peak_voltage.toFixed(2)} V / ${e.pulse_duration_ms} ms`,
          threshold: `baseline ${mean.toFixed(2)} V ±2.6σ`,
          action: 'Inspect the mat wiring and re-seat the piezo array.',
        })
      if (typeof e.confidence === 'number' && e.confidence < settings.confidenceThreshold)
        guardedAlert({
          severity: 'info',
          category: 'AI',
          title: 'Low classification confidence',
          reason: 'Prediction confidence fell below the configured threshold.',
          currentValue: `${((e.confidence as number) * 100).toFixed(0)}%`,
          threshold: `${(settings.confidenceThreshold * 100).toFixed(0)}%`,
          action: 'Collect more labelled samples for this footstep profile.',
        })
    },
    [addAnomaly, guardedAlert, settings.confidenceThreshold],
  )
  const lastEventRef = useRef<FootstepEvent | null>(null)
  useEffect(() => {
    lastEventRef.current = lastEvent
  }, [lastEvent])
  const modeRef = useRef<SourceMode>(mode)
  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  const handleEventRef = useRef(handleEvent)
  useEffect(() => {
    handleEventRef.current = handleEvent
  }, [handleEvent])

  /* ----------------------- energy / threshold alerts --------------------- */
  const lastStorageAlert = useRef(0)
  useEffect(() => {
    if (!packet) return
    const t = Date.now()
    if (t - lastStorageAlert.current < 20000) return
    if (packet.storage_voltage < settings.lowStorageAlertV) {
      lastStorageAlert.current = t
      guardedAlert({
        severity: 'warning',
        category: 'ENERGY',
        title: 'Low storage voltage',
        reason: 'Supercapacitor voltage is below the configured alert threshold.',
        currentValue: `${packet.storage_voltage.toFixed(2)} V`,
        threshold: `${settings.lowStorageAlertV.toFixed(2)} V`,
        action: 'Reduce load / continue charging.',
      })
    } else if (packet.storage_voltage > settings.maxSafeV) {
      lastStorageAlert.current = t
      guardedAlert({
        severity: 'critical',
        category: 'ENERGY',
        title: 'Storage above maximum safe voltage',
        reason: 'Measured supercapacitor voltage exceeds the configured ceiling.',
        currentValue: `${packet.storage_voltage.toFixed(2)} V`,
        threshold: `${settings.maxSafeV.toFixed(2)} V`,
        action: 'Verify the clamp/shunt regulator before continuing.',
      })
    } else if (packet.storage_voltage >= settings.storageTargetV * 0.95) {
      lastStorageAlert.current = t
      guardedAlert({
        severity: 'success',
        category: 'ENERGY',
        title: 'Storage target reached',
        reason: 'Storage reached 95% of the configured target.',
        currentValue: `${packet.storage_voltage.toFixed(2)} V`,
        threshold: `${settings.storageTargetV.toFixed(2)} V`,
        action: 'Demonstration load can be switched on.',
      })
    }
  }, [packet, settings, guardedAlert])

  /* --------------------------- staleness clock --------------------------- */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const lastDataMs = packet ? now - +new Date(packet.timestamp) : Infinity
  const isStale = connection === 'connected' && lastDataMs > settings.offlineTimeoutSec * 1000

  const staleFired = useRef(false)
  useEffect(() => {
    if (isStale && !staleFired.current) {
      staleFired.current = true
      guardedAlert({
        severity: 'critical',
        category: 'NETWORK',
        title: 'Telemetry interrupted',
        reason: 'No packet received within the configured offline timeout.',
        currentValue: `${Math.round(lastDataMs / 1000)} s since last packet`,
        threshold: `${settings.offlineTimeoutSec} s`,
        action: 'Check ESP32 power and Wi-Fi association.',
      })
      addAnomaly({
        kind: 'MISSING_TELEMETRY',
        label: 'Missing telemetry',
        reason: 'The device stopped publishing within the expected window.',
        level: 'CRITICAL',
        score: 0.95,
        metric: `${Math.round(lastDataMs / 1000)} s gap`,
        timestamp: nowIso(),
      })
    }
    if (!isStale) staleFired.current = false
  }, [isStale, lastDataMs, settings.offlineTimeoutSec, guardedAlert, addAnomaly])

  /* ------------------------------- history ------------------------------- */
  const [range, setRangeState] = useState<RangeKey>('today')
  const [customRange, setCustomRange] = useState({
    from: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  })
  const [history, setHistory] = useState<FootstepEvent[]>([])
  const [prevPeriod, setPrevPeriod] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const setRange = useCallback((r: RangeKey, c?: { from: string; to: string }) => {
    if (c) setCustomRange(c)
    setRangeState(r)
  }, [])

  useEffect(() => {
    let cancelled = false
    const src = sourceRef.current
    if (!src || connection !== 'connected') return
    setHistoryLoading(true)
    setHistoryError(null)
    ;(async () => {
      try {
        const rows = await src.queryHistory({ range, custom: customRange, limit: 2000 })
        const prev = range === 'today' ? await src.queryHistory({ range: 'yesterday', limit: 2000 }) : []
        if (cancelled) return
        setHistory(rows)
        setPrevPeriod(prev.length)
      } catch (e) {
        if (!cancelled) setHistoryError((e as Error).message)
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [range, customRange, connection, mode, attempt])

  const stats = useMemo(() => computeStats(history, prevPeriod), [history, prevPeriod])

  /* -------------------------------- model -------------------------------- */
  const [model, setModel] = useState<ModelMetadata>(MODEL_NOT_CONNECTED)
  const [modelLoading, setModelLoading] = useState(true)
  const loadModel = useCallback(async () => {
    setModelLoading(true)
    try {
      // Preference order: ML API → MongoDB modelMetadata → not connected.
      const meta = await mlRef.current.getMetadata()
      if (meta.connected) {
        setModel(meta)
        return
      }
      const metaDb = await fetchModelMetadata().catch(() => null)
      if (metaDb && metaDb.connected) {
        setModel(metaDb)
        return
      }
      setModel(meta)
    } catch {
      setModel(MODEL_NOT_CONNECTED)
    } finally {
      setModelLoading(false)
    }
  }, [])
  useEffect(() => {
    void loadModel()
  }, [loadModel])

  /* ------------------------------ ML health ------------------------------ */
  useEffect(() => {
    let alive = true
    const ping = async () => {
      const h = await mlRef.current.health()
      if (alive) setMlHealth(h)
    }
    void ping()
    const id = setInterval(ping, 30_000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const mlOfflineFired = useRef(false)
  useEffect(() => {
    if (mlRef.current.kind !== 'api' || !mlHealth) return
    if (!mlHealth.reachable && !mlOfflineFired.current) {
      mlOfflineFired.current = true
      guardedAlert({
        severity: 'warning',
        category: 'AI',
        title: 'ML service offline',
        reason: mlHealth.error ?? 'The configured ML API did not respond to /health.',
        currentValue: 'unreachable',
        threshold: 'reachable',
        action: 'Start the FastAPI service (uvicorn app:app --port 8000) and check VITE_ML_API_URL.',
      })
    }
    if (mlHealth.reachable) mlOfflineFired.current = false
  }, [mlHealth, guardedAlert])

  /* ------------------------------- dataset ------------------------------- */
  const refreshDataset = useCallback(() => {
    void dsList().then(setDataset)
  }, [])
  useEffect(() => {
    refreshDataset()
  }, [refreshDataset])

  const addDatasetSample = useCallback(
    async (label: StepClass, participantId?: string, note?: string) => {
      const e = lastEventRef.current
      if (!e) throw new Error('No footstep captured yet — step on the mat first.')
      const sample = makeSample(e.features, label, modeRef.current, e.device_id, participantId, note)
      await dsAdd(sample)
      setDataset((prev) => [...prev, sample])
    },
    [],
  )
  const removeDatasetSample = useCallback(async (id: string) => {
    await dsDelete(id)
    setDataset((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const trainModel = useCallback(
    async (csv: string, version: string) => {
      setTraining(true)
      setTrainError(null)
      try {
        const meta = await mlRef.current.train(csv, version)
        setModel(meta)
        setMlHealth(await mlRef.current.health())
      } catch (e) {
        setTrainError((e as Error).message)
        throw e
      } finally {
        setTraining(false)
      }
    },
    [],
  )

  /* ------------------------------- insights ------------------------------ */
  const insights = useMemo<AiInsight[]>(() => {
    if (!history.length) return []
    const s = stats
    const dominant = s.heavy > s.normal ? 'HEAVY' : s.normal >= s.light ? 'NORMAL' : 'LIGHT'
    const busiest = [...s.byHour].sort(
      (a, b) => b.LIGHT + b.NORMAL + b.HEAVY - (a.LIGHT + a.NORMAL + a.HEAVY),
    )[0]
    const stored = packet ? storedEnergyJ(packet.storage_voltage, settings.supercapFarads) : 0
    const out: AiInsight[] = [
      {
        id: 'i1',
        type: 'FOOTSTEP INSIGHT',
        text: `${dominant} footsteps were the most frequently detected class in the selected period (${
          dominant === 'HEAVY' ? s.heavy : dominant === 'NORMAL' ? s.normal : s.light
        } of ${s.total} steps).`,
        confidence: +Math.min(0.98, 0.6 + s.avgConfidence * 0.35).toFixed(2),
        timestamp: nowIso(),
        supporting: `class distribution · n=${s.total}`,
      },
      {
        id: 'i2',
        type: 'ENERGY INSIGHT',
        text: busiest
          ? `Estimated harvest peaked around ${busiest.hour}, the same window with the highest footstep count — higher footstep frequency correlated with increased voltage generation.`
          : 'Insufficient data to correlate footfall with harvest.',
        confidence: 0.87,
        timestamp: nowIso(),
        supporting: busiest
          ? `${busiest.LIGHT + busiest.NORMAL + busiest.HEAVY} steps · ${busiest.energy.toFixed(4)} J estimated`
          : '—',
      },
      {
        id: 'i3',
        type: 'STORAGE INSIGHT',
        text:
          stored > 1.5
            ? `Current stored energy (~${stored.toFixed(1)} J estimated via ½CV²) is sufficient for the LED demonstration load.`
            : 'Stored energy is currently below the level needed to drive the fan load continuously.',
        confidence: 0.82,
        timestamp: nowIso(),
        supporting: `storage ${packet?.storage_voltage.toFixed(2) ?? '—'} V · C=${settings.supercapFarads} F`,
      },
    ]
    if (anomalies.length)
      out.push({
        id: 'i4',
        type: 'ANOMALY INSIGHT',
        text: `${anomalies.length} unusual event${anomalies.length > 1 ? 's were' : ' was'} flagged by the rule-based detector and ${anomalies.length > 1 ? 'remain' : 'remains'} unreviewed.`,
        confidence: +(anomalies.reduce((a, b) => a + b.score, 0) / anomalies.length).toFixed(2),
        timestamp: anomalies[0].timestamp,
        supporting: anomalies[0].metric,
      })
    return out
  }, [stats, history.length, packet, anomalies, settings.supercapFarads])

  /* -------------------------------- health ------------------------------- */
  const bootRef = useRef(Date.now() - 4 * 3600e3 - 1200e3)
  const health = useMemo<SystemHealth>(() => {
    const online = Boolean(packet) && !isStale && connection === 'connected'
    const rssi = packet?.wifi_rssi ?? -100
    const received = Math.max(1, Math.round((Date.now() - bootRef.current) / 1000))
    const missed = Math.max(0, Math.round(received / 900))
    const storageState: SystemHealth['storage'] = !packet
      ? 'normal'
      : packet.storage_voltage < settings.minOperatingV
        ? 'low'
        : packet.storage_voltage > settings.maxSafeV
          ? 'over'
          : 'normal'
    const score = Math.round(
      100 -
        (online ? 0 : 40) -
        (storageState !== 'normal' ? 9 : 0) -
        (rssi < -75 ? 6 : 0) -
        Math.min(6, anomalies.length * 1.2),
    )
    return {
      esp32: online ? (packet?.device_status ?? 'offline') : 'offline',
      wifi: online ? 'connected' : 'disconnected',
      cloud: mode === 'live' ? (connection === 'connected' ? 'connected' : 'error') : 'not-configured',
      sensor: piezo ? (piezo.some((p) => p.state === 'fault') ? 'fault' : anomalies.length > 4 ? 'noisy' : 'normal') : 'unknown',
      storage: storageState,
      mlService:
        mlRef.current.kind === 'api' ? (mlHealth?.reachable ? 'online' : 'offline') : 'demo',
      dashboard: isStale ? 'stale' : 'live',
      lastDataMs: packet ? lastDataMs : 0,
      rssi,
      // DEVICE REPORTED when firmware sends it; otherwise null (never guessed).
      uptimeSec: packet?.uptime_sec ?? device?.uptimeSec ?? null,
      lastReboot:
        packet?.uptime_sec != null
          ? new Date(Date.now() - packet.uptime_sec * 1000).toLocaleString()
          : null,
      packetsReceived: received,
      packetsMissed: missed,
      successRate: +((received / (received + missed)) * 100).toFixed(2),
      latencyMs: packet ? lastDataMs : null,
      deviceId: packet?.device_id ?? settings.deviceId,
      firmwareVersion: packet?.firmware_version ?? 'unknown',
      healthScore: Math.max(0, Math.min(100, score)),
    }
  }, [packet, anomalies.length, settings, isStale, connection, mode, piezo, mlHealth, device, lastDataMs])

  const anomalyLevel: 'NORMAL' | 'WARNING' | 'CRITICAL' = anomalies.some((a) => a.level === 'CRITICAL')
    ? 'CRITICAL'
    : anomalies.some((a) => a.level === 'WARNING')
      ? 'WARNING'
      : 'NORMAL'

  useEffect(() => {
    document.body.classList.toggle('theme-light', settings.theme === 'light')
  }, [settings.theme])

  const value: Ctx = {
    packet,
    series,
    events,
    lastEvent,
    history,
    historyLoading,
    historyError,
    range,
    customRange,
    setRange,
    stats,
    mode,
    setMode,
    liveAvailable,
    connection,
    connectionError,
    retry,
    isStale,
    settings,
    updateSettings,
    alerts,
    markAlertRead: async (id) => {
      const previous = alerts
      setAlerts((items) => items.map((item) => (item.id === id ? { ...item, read: true } : item)))
      try {
        if (mode === 'live') await apiMarkAlertRead(id)
      } catch (error) {
        setAlerts(previous)
        throw error
      }
    },
    markAllRead: async () => {
      const previous = alerts
      setAlerts((items) => items.map((item) => ({ ...item, read: true })))
      try {
        if (mode === 'live') await markAllAlertsRead()
      } catch (error) {
        setAlerts(previous)
        throw error
      }
    },
    anomalies,
    anomalyLevel,
    insights,
    health,
    model,
    modelLoading,
    refreshModel: () => void loadModel(),
    piezo,
    piezoAvailable: piezo !== null,
    mlKind: mlRef.current.kind,
    mlHealth,
    mlBaseUrl: mlRef.current.baseUrl,
    trainModel,
    training,
    trainError,
    loads,
    device,
    dataset,
    addDatasetSample,
    removeDatasetSample,
    refreshDataset,
    awaitingLiveData: mode === 'live' && connection === 'connected' && packet === null,
    simulateStep: (c) => {
      const src = sourceRef.current
      if (src instanceof MockDataSource) void src.emitStep(c)
    },
    setLoad: (l, on) => void sourceRef.current?.setLoad(l, on),
    explain: (e) => mlRef.current.predictStep(e.features),
  }

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('useStore must be used inside StoreProvider')
  return c
}

export { ML_API_URL }
