import type { MlService } from '../services/ml/mlService'
import {
  eventFromPayload,
  normalise,
  subscribeFootstepEvents,
  subscribeLatestTelemetry,
} from '../services/firebase/telemetryService'
import { subscribeLoads, writeLoadCommand } from '../services/firebase/loadService'
import { subscribeDevice } from '../services/firebase/deviceService'
import { queryEvents } from '../services/firebase/historyService'
import { fetchPiezoArray } from '../services/firebase/deviceService'
import { isFirebaseConfigured } from '../services/firebase/config'
import type {
  DataSource,
  DeviceInfo,
  Esp32Payload,
  FootstepEvent,
  HistoryQuery,
  LoadKey,
  LoadMap,
  PiezoSensor,
  TelemetryPacket,
} from './types'
import { EMPTY_LOADS } from './types'

/**
 * LIVE DATA SOURCE — ESP32 → Wi-Fi → Firebase RTDB → here.
 *
 * Nothing is synthesised. If the hardware does not report a field it stays
 * null and the UI renders "Not measured". When a step arrives without an
 * on-device label, the configured ML service classifies it and the result is
 * tagged ML PREDICTION (or DEMO PREDICTION if only the heuristic is available,
 * so a reviewer can always see which produced the label).
 */
export class LiveDataSource implements DataSource {
  readonly mode = 'live' as const
  readonly label = 'LIVE TELEMETRY'

  private telemetrySubs = new Set<(p: TelemetryPacket) => void>()
  private eventSubs = new Set<(e: FootstepEvent) => void>()
  private detach: Array<() => void> = []
  private lastPacket: TelemetryPacket | null = null
  private loadSubs = new Set<(l: LoadMap) => void>()
  private deviceSubs = new Set<(d: DeviceInfo | null) => void>()
  private lastLoads: LoadMap = EMPTY_LOADS
  private lastDevice: DeviceInfo | null = null

  private ml: MlService
  private farads: number
  private onError: (e: Error) => void

  constructor(ml: MlService, farads: number, onError: (e: Error) => void) {
    this.ml = ml
    this.farads = farads
    this.onError = onError
  }

  static get available() {
    return isFirebaseConfigured()
  }

  async connect() {
    if (!isFirebaseConfigured())
      throw new Error(
        'Live mode unavailable: Firebase is not configured. Add VITE_FIREBASE_DB_URL, VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID to .env.local and reload.',
      )
    this.detach.push(
      await subscribeLatestTelemetry((raw) => this.handleTelemetry(raw), this.onError),
      await subscribeFootstepEvents((raw, key) => void this.handleEvent(raw, key), this.onError),
      await subscribeLoads((l) => {
        this.lastLoads = l
        this.loadSubs.forEach((cb) => cb(l))
        if (this.lastPacket) {
          this.lastPacket = { ...this.lastPacket, loads: l }
          this.telemetrySubs.forEach((cb) => cb(this.lastPacket!))
        }
      }, this.onError),
      await subscribeDevice((d) => {
        this.lastDevice = d
        this.deviceSubs.forEach((cb) => cb(d))
      }, this.onError),
    )
  }

  disconnect() {
    this.detach.forEach((fn) => {
      try {
        fn()
      } catch {
        /* listener already detached */
      }
    })
    this.detach = []
    this.telemetrySubs.clear()
    this.eventSubs.clear()
    this.loadSubs.clear()
    this.deviceSubs.clear()
  }

  private handleTelemetry(raw: Esp32Payload) {
    const pkt = { ...normalise(raw, this.farads), loads: this.lastLoads }
    this.lastPacket = pkt
    this.telemetrySubs.forEach((cb) => cb(pkt))
  }

  private async handleEvent(raw: Esp32Payload, key: string) {
    const evt = eventFromPayload(raw, key)
    // Classify only when the device did not already label the step.
    if (evt.prediction_source === 'UNCLASSIFIED') {
      try {
        const pred = await this.ml.predictStep(evt.features)
        evt.step_class = pred.class
        evt.confidence = pred.confidence
        evt.prediction_source = pred.source
        if (this.lastPacket) {
          this.lastPacket = {
            ...this.lastPacket,
            step_class: pred.class,
            confidence: pred.confidence,
            probabilities: pred.probabilities,
            prediction_source: pred.source,
          }
          this.telemetrySubs.forEach((cb) => cb(this.lastPacket!))
        }
      } catch (e) {
        this.onError(e as Error)
      }
    }
    this.eventSubs.forEach((cb) => cb(evt))
  }

  subscribeTelemetry(cb: (p: TelemetryPacket) => void) {
    this.telemetrySubs.add(cb)
    if (this.lastPacket) cb(this.lastPacket)
    return () => this.telemetrySubs.delete(cb) as unknown as void
  }

  subscribeEvents(cb: (e: FootstepEvent) => void) {
    this.eventSubs.add(cb)
    return () => this.eventSubs.delete(cb) as unknown as void
  }

  async queryHistory(q: HistoryQuery): Promise<FootstepEvent[]> {
    return queryEvents(q)
  }

  async getPiezoArray(): Promise<PiezoSensor[] | null> {
    try {
      return await fetchPiezoArray()
    } catch {
      return null
    }
  }

  subscribeLoads(cb: (l: LoadMap) => void) {
    this.loadSubs.add(cb)
    cb(this.lastLoads)
    return () => this.loadSubs.delete(cb) as unknown as void
  }

  subscribeDevice(cb: (d: DeviceInfo | null) => void) {
    this.deviceSubs.add(cb)
    cb(this.lastDevice)
    return () => this.deviceSubs.delete(cb) as unknown as void
  }

  /** Writes the command only — actualState is reported by the firmware. */
  async setLoad(load: LoadKey, on: boolean) {
    await writeLoadCommand(load, on)
  }
}
