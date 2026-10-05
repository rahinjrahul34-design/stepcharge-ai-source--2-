import { stepEnergyJ, storedEnergyJ } from './energy'
import type { MlService } from '../services/ml/mlService'
import type {
  DataSource,
  DeviceInfo,
  FootstepEvent,
  HistoryQuery,
  LoadKey,
  LoadMap,
  PiezoSensor,
  StepClass,
  StepFeatures,
  TelemetryPacket,
} from './types'
import { rangeBoundsLocal } from './rangeBounds'

/* ------------------------------------------------------------------ *
 * DEMO DATA SOURCE
 * Everything produced here is SIMULATED. Nothing touches hardware.
 * Packets are tagged source:'demo' so the UI can label them honestly.
 * ------------------------------------------------------------------ */

const DEVICE_ID = 'STEPCHARGE-DEMO'
let seq = 0
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`
const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

const CLASS_PROFILE: Record<StepClass, { peak: [number, number]; pulse: [number, number] }> = {
  LIGHT: { peak: [1.1, 2.3], pulse: [90, 150] },
  NORMAL: { peak: [2.6, 4.1], pulse: [150, 230] },
  HEAVY: { peak: [4.2, 5.4], pulse: [220, 330] },
}

function pickClass(): StepClass {
  const r = Math.random()
  if (r < 0.2) return 'LIGHT'
  if (r < 0.87) return 'NORMAL'
  return 'HEAVY'
}

/** Generates a physically plausible feature vector for one footstep. */
export function synthFeatures(forced?: StepClass): StepFeatures {
  const prof = CLASS_PROFILE[forced ?? pickClass()]
  const peak = rnd(prof.peak[0], prof.peak[1])
  return {
    peakVoltage: +peak.toFixed(2),
    averageVoltage: +(peak * rnd(0.58, 0.72)).toFixed(2),
    pulseDuration: Math.round(rnd(prof.pulse[0], prof.pulse[1])),
    stepInterval: +rnd(0.9, 2.6).toFixed(2),
    storageVoltage: 0,
  }
}

export class MockDataSource implements DataSource {
  readonly mode = 'demo' as const
  readonly label = 'DEMO DATA'

  private telemetrySubs = new Set<(p: TelemetryPacket) => void>()
  private eventSubs = new Set<(e: FootstepEvent) => void>()
  private timer?: number
  private stepTimer?: number
  private archive: FootstepEvent[] = []
  private piezo: PiezoSensor[] = []
  private loadSubs = new Set<(l: LoadMap) => void>()
  private deviceSubs = new Set<(d: DeviceInfo | null) => void>()
  private bootMs = Date.now() - 4 * 3600e3

  private state = {
    count: 0,
    storage: 4.21,
    peakNow: 0.18,
    avgNow: 0.12,
    pulse: 0,
    interval: 1800,
    cls: 'NORMAL' as StepClass,
    conf: 0.91,
    probs: { LIGHT: 0.18, NORMAL: 0.71, HEAVY: 0.11 } as Record<StepClass, number>,
    led: true,
    fan: false,
    rssi: -61,
  }

  /** The simulated firmware acknowledges commands after a realistic delay. */
  private loads: LoadMap = {
    led: { command: true, actualState: true, reportedAt: new Date().toISOString() },
    fan: { command: false, actualState: false, reportedAt: new Date().toISOString() },
  }

  private ml: MlService
  private farads: number

  constructor(ml: MlService, farads = 1.0) {
    this.ml = ml
    this.farads = farads
    this.archive = this.backfill(30)
    this.state.count = this.archive.length
    this.piezo = Array.from({ length: 15 }, (_, i) => {
      const roll = Math.random()
      const state: PiezoSensor['state'] =
        roll > 0.93 ? 'fault' : roll > 0.84 ? 'weak' : roll > 0.8 ? 'inactive' : 'healthy'
      return {
        id: `P${i + 1}`,
        index: i + 1,
        state,
        voltage: +(state === 'fault' ? 0 : state === 'weak' ? rnd(0.4, 1.2) : rnd(2.2, 4.8)).toFixed(2),
        activityCount: state === 'inactive' ? 0 : Math.round(rnd(40, 420)),
        lastActive: new Date(Date.now() - rnd(0, 36e5)).toISOString(),
      }
    })
  }

  /** Synchronous heuristic used only for the 30-day backfill (keeps startup fast). */
  private quickClass(f: StepFeatures): { cls: StepClass; conf: number } {
    const cls: StepClass = f.peakVoltage < 2.45 ? 'LIGHT' : f.peakVoltage > 4.15 ? 'HEAVY' : 'NORMAL'
    return { cls, conf: +clamp(0.62 + Math.random() * 0.33, 0.45, 0.98).toFixed(3) }
  }

  private makeEvent(at: Date, f: StepFeatures, cls: StepClass, conf: number): FootstepEvent {
    return {
      id: uid('evt'),
      timestamp: at.toISOString(),
      device_id: DEVICE_ID,
      features: f,
      step_class: cls,
      confidence: conf,
      prediction_source: 'DEMO PREDICTION',
      peak_voltage: f.peakVoltage,
      pulse_duration_ms: f.pulseDuration,
      step_interval_ms: Math.round(f.stepInterval * 1000),
      storage_voltage: f.storageVoltage,
      estimated_energy_j: +stepEnergyJ(f.averageVoltage, f.pulseDuration).toFixed(6),
      source: 'demo',
    }
  }

  private backfill(days: number): FootstepEvent[] {
    const out: FootstepEvent[] = []
    const now = Date.now()
    for (let d = days - 1; d >= 0; d--) {
      const dayStart = new Date(now - d * 864e5)
      dayStart.setHours(7, 0, 0, 0)
      const steps = Math.round(rnd(140, 320) * (d === 0 ? 0.6 : 1))
      for (let i = 0; i < steps; i++) {
        const hourOffset = Math.random() < 0.5 ? rnd(0, 4.5) : rnd(8, 13)
        const t = new Date(dayStart.getTime() + hourOffset * 36e5 + rnd(0, 36e5))
        if (t.getTime() > now) continue
        const f = synthFeatures()
        f.storageVoltage = +clamp(2.6 + (i / steps) * 1.9 + rnd(-0.1, 0.1), 1.8, 5.2).toFixed(2)
        const { cls, conf } = this.quickClass(f)
        out.push(this.makeEvent(t, f, cls, conf))
      }
    }
    return out.sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))
  }

  async connect() {
    if (this.timer) return
    this.timer = window.setInterval(() => this.tick(), 400)
    this.scheduleStep()
  }

  disconnect() {
    window.clearInterval(this.timer)
    window.clearTimeout(this.stepTimer)
    this.timer = undefined
    this.stepTimer = undefined
    this.telemetrySubs.clear()
    this.eventSubs.clear()
    this.loadSubs.clear()
    this.deviceSubs.clear()
  }

  private scheduleStep() {
    this.stepTimer = window.setTimeout(
      () => {
        void this.emitStep()
        this.scheduleStep()
      },
      rnd(1500, 3800),
    )
  }

  /** Full event pipeline: features → ML service → energy → storage → subscribers. */
  async emitStep(forced?: StepClass) {
    const f = synthFeatures(forced)
    f.storageVoltage = this.state.storage
    const pred = await this.ml.predictStep(f)

    this.state.count += 1
    this.state.cls = pred.class
    this.state.conf = pred.confidence
    this.state.probs = pred.probabilities
    this.state.peakNow = f.peakVoltage
    this.state.avgNow = f.averageVoltage
    this.state.pulse = f.pulseDuration
    this.state.interval = Math.round(f.stepInterval * 1000)
    const gain = { LIGHT: 0.012, NORMAL: 0.026, HEAVY: 0.041 }[pred.class]
    this.state.storage = +clamp(this.state.storage + gain, 1.5, 5.4).toFixed(3)

    const e = this.makeEvent(new Date(), f, pred.class, pred.confidence)
    e.prediction_source = pred.source
    e.storage_voltage = this.state.storage
    this.archive.push(e)
    this.eventSubs.forEach((cb) => cb(e))
    this.telemetrySubs.forEach((cb) => cb(this.packet()))
    return e
  }

  private tick() {
    this.state.peakNow = +Math.max(0.1, this.state.peakNow * 0.72 + rnd(-0.02, 0.04)).toFixed(3)
    this.state.avgNow = +Math.max(0.06, this.state.avgNow * 0.72 + rnd(-0.01, 0.03)).toFixed(3)
    const draw = (this.state.led ? 0.0016 : 0) + (this.state.fan ? 0.0062 : 0) + 0.0004
    this.state.storage = +clamp(this.state.storage - draw, 1.2, 5.4).toFixed(3)
    this.state.rssi = Math.round(clamp(this.state.rssi + rnd(-2, 2), -82, -44))
    this.telemetrySubs.forEach((cb) => cb(this.packet()))
  }

  private packet(): TelemetryPacket {
    const s = this.state
    return {
      timestamp: new Date().toISOString(),
      device_id: DEVICE_ID,
      footstep_count: s.count,
      peak_voltage: s.peakNow,
      average_voltage: s.avgNow,
      storage_voltage: s.storage,
      pulse_duration_ms: s.pulse,
      step_interval_ms: s.interval,
      // The demo mat has no current sensor either — modelled as unavailable so
      // the "Not measured" UI path is exercised during presentations.
      current_a: null,
      power_w: null,
      measured_energy_j: null,
      estimated_energy_j: +storedEnergyJ(s.storage, this.farads).toFixed(3),
      step_class: s.cls,
      confidence: s.conf,
      probabilities: s.probs,
      prediction_source: 'DEMO PREDICTION',
      loads: this.loads,
      load_control_available: true,
      wifi_rssi: s.rssi,
      uptime_sec: Math.round((Date.now() - this.bootMs) / 1000),
      device_status: 'online',
      firmware_version: 'demo-sim-1.3',
      source: 'demo',
    }
  }

  subscribeTelemetry(cb: (p: TelemetryPacket) => void) {
    this.telemetrySubs.add(cb)
    cb(this.packet())
    return () => this.telemetrySubs.delete(cb) as unknown as void
  }

  subscribeEvents(cb: (e: FootstepEvent) => void) {
    this.eventSubs.add(cb)
    return () => this.eventSubs.delete(cb) as unknown as void
  }

  async queryHistory(q: HistoryQuery) {
    const { from, to } = rangeBoundsLocal(q)
    const rows = this.archive.filter((e) => {
      const t = +new Date(e.timestamp)
      return t >= from && t <= to
    })
    // Mirror the live source's server-side cap so both behave identically.
    const limit = q.limit ?? 2000
    return rows.slice(-limit)
  }

  async getPiezoArray() {
    return this.piezo
  }

  subscribeLoads(cb: (l: LoadMap) => void) {
    this.loadSubs.add(cb)
    cb(this.loads)
    return () => this.loadSubs.delete(cb) as unknown as void
  }

  subscribeDevice(cb: (d: DeviceInfo | null) => void) {
    this.deviceSubs.add(cb)
    cb({
      deviceId: DEVICE_ID,
      name: 'StepCharge Mat (simulated)',
      location: 'Demo mode — no hardware',
      firmwareVersion: 'demo-sim-1.3',
      status: 'ONLINE',
      lastSeen: new Date().toISOString(),
      uptimeSec: Math.round((Date.now() - this.bootMs) / 1000),
      wifiRssi: this.state.rssi,
    })
    return () => this.deviceSubs.delete(cb) as unknown as void
  }

  /**
   * Mirrors the real chain: the command is stored immediately, the simulated
   * firmware confirms actualState ~400 ms later.
   */
  async setLoad(load: LoadKey, on: boolean) {
    this.loads = {
      ...this.loads,
      [load]: { command: on, actualState: this.loads[load].actualState, updatedAt: new Date().toISOString() },
    }
    this.loadSubs.forEach((cb) => cb(this.loads))
    this.telemetrySubs.forEach((cb) => cb(this.packet()))
    window.setTimeout(() => {
      if (load === 'led') this.state.led = on
      else this.state.fan = on
      this.loads = {
        ...this.loads,
        [load]: { command: on, actualState: on, updatedAt: this.loads[load].updatedAt, reportedAt: new Date().toISOString() },
      }
      this.loadSubs.forEach((cb) => cb(this.loads))
      this.telemetrySubs.forEach((cb) => cb(this.packet()))
    }, 420)
  }
}
