import type {
  Esp32Payload,
  FootstepEvent,
  PredictionSource,
  StepClass,
  StepLabel,
  TelemetryPacket,
} from '../../data/types'
import { EMPTY_LOADS } from '../../data/types'
import { storedEnergyJ, stepEnergyJ } from '../../data/energy'
import { deviceId, fetchApi } from './client'
import { getSocket } from './socket'

/* ------------------------------------------------------------------ *
 * Validation — malformed or physically impossible packets are rejected
 * rather than plotted. Hardware glitches must not corrupt the charts.
 * ------------------------------------------------------------------ */

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const inRange = (v: unknown, lo: number, hi: number): v is number => finite(v) && v >= lo && v <= hi
const nullableInRange = (v: unknown, lo: number, hi: number): v is number | null =>
  v === null || v === undefined || inRange(v, lo, hi)

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

export function validatePayload(raw: unknown): ValidationResult {
  const errors: string[] = []
  if (typeof raw !== 'object' || raw === null) return { ok: false, errors: ['payload is not an object'] }
  const p = raw as Record<string, unknown>
  if (typeof p.deviceId !== 'string' || !p.deviceId) errors.push('deviceId missing')
  if (!inRange(p.peakVoltage, 0, 60)) errors.push('peakVoltage out of range (0–60 V)')
  if (!inRange(p.averageVoltage, 0, 60)) errors.push('averageVoltage out of range (0–60 V)')
  if (!inRange(p.storageVoltage, 0, 60)) errors.push('storageVoltage out of range (0–60 V)')
  if (!inRange(p.footstepCount, 0, 1e9)) errors.push('footstepCount invalid')
  if (!inRange(p.pulseDuration, 0, 60_000)) errors.push('pulseDuration out of range')
  if (!nullableInRange(p.current, -50, 50)) errors.push('current out of range')
  if (!nullableInRange(p.power, -1000, 1000)) errors.push('power out of range')
  if (!nullableInRange(p.energy, 0, 1e7)) errors.push('energy out of range')
  if (p.wifiRssi !== undefined && !inRange(p.wifiRssi, -120, 0)) errors.push('wifiRssi out of range')
  if (p.uptimeSec !== undefined && !inRange(p.uptimeSec, 0, 3.2e9)) errors.push('uptimeSec invalid')
  if (!inRange(p.averageVoltage, 0, 60) || (p.averageVoltage as number) > (p.peakVoltage as number) * 1.05)
    errors.push('averageVoltage exceeds peakVoltage')
  return { ok: errors.length === 0, errors }
}

const toStatus = (s: string | undefined) =>
  s === 'ONLINE' ? 'online' : s === 'DEGRADED' ? 'degraded' : 'offline'

/** Maps the wire format to the internal packet. No value is invented here. */
export function normalise(p: Esp32Payload, farads: number): TelemetryPacket {
  const hasDevicePrediction = Boolean(p.stepClass)
  const source: PredictionSource = hasDevicePrediction ? 'DEVICE PREDICTION' : 'UNCLASSIFIED'
  const cls: StepLabel = hasDevicePrediction ? (p.stepClass as StepClass) : 'UNKNOWN'
  const conf = hasDevicePrediction && typeof p.confidence === 'number' ? p.confidence : null
  return {
    timestamp: p.timestamp ?? new Date().toISOString(),
    device_id: p.deviceId,
    footstep_count: p.footstepCount,
    peak_voltage: p.peakVoltage,
    average_voltage: p.averageVoltage,
    storage_voltage: p.storageVoltage,
    pulse_duration_ms: p.pulseDuration,
    step_interval_ms: Math.round((p.stepInterval ?? 0) * 1000),
    current_a: p.current ?? null,
    power_w: p.power ?? (p.current !== null && p.current !== undefined ? p.storageVoltage * p.current : null),
    measured_energy_j: p.energy ?? null,
    estimated_energy_j: storedEnergyJ(p.storageVoltage, farads),
    step_class: cls,
    confidence: conf,
    probabilities:
      hasDevicePrediction && conf !== null
        ? ({ LIGHT: 0, NORMAL: 0, HEAVY: 0, [cls as StepClass]: conf } as Record<StepClass, number>)
        : null,
    prediction_source: source,
    loads: EMPTY_LOADS,
    load_control_available: Boolean(p.loadControlAvailable),
    wifi_rssi: p.wifiRssi ?? -100,
    uptime_sec: typeof p.uptimeSec === 'number' ? p.uptimeSec : null,
    device_status: toStatus(p.deviceStatus),
    firmware_version: p.firmwareVersion ?? 'unknown',
    source: 'live',
  }
}

export function eventFromPayload(p: Esp32Payload, id: string): FootstepEvent {
  const features = {
    peakVoltage: p.peakVoltage,
    averageVoltage: p.averageVoltage,
    pulseDuration: p.pulseDuration,
    stepInterval: p.stepInterval,
    storageVoltage: p.storageVoltage,
  }
  return {
    id,
    timestamp: p.timestamp ?? new Date().toISOString(),
    device_id: p.deviceId,
    features,
    step_class: (p.stepClass ?? 'UNKNOWN') as StepLabel,
    confidence: typeof p.confidence === 'number' ? p.confidence : null,
    prediction_source: p.stepClass ? 'DEVICE PREDICTION' : 'UNCLASSIFIED',
    peak_voltage: p.peakVoltage,
    pulse_duration_ms: p.pulseDuration,
    step_interval_ms: Math.round((p.stepInterval ?? 0) * 1000),
    storage_voltage: p.storageVoltage,
    estimated_energy_j: stepEnergyJ(p.averageVoltage, p.pulseDuration),
    source: 'live',
  }
}

/* ------------------------------------------------------------------ *
 * Realtime Subscriptions via Socket.IO + REST Fallback
 * ------------------------------------------------------------------ */

export async function subscribeLatestTelemetry(
  onPacket: (p: Esp32Payload) => void,
  onError: (e: Error) => void,
): Promise<() => void> {
  const socket = getSocket()

  // Fetch initial latest telemetry state via REST
  fetchApi<Esp32Payload | null>(`/devices/${deviceId()}/telemetry/latest`)
    .then((raw) => {
      if (raw) {
        const v = validatePayload(raw)
        if (v.ok) onPacket(raw)
      }
    })
    .catch((err) => {
      console.warn('[Telemetry] Initial fetch error:', err.message)
    })

  const handler = (raw: any) => {
    if (!raw) return
    const v = validatePayload(raw)
    if (!v.ok) {
      onError(new Error(`Rejected malformed telemetry: ${v.errors.join('; ')}`))
      return
    }
    onPacket(raw as Esp32Payload)
  }

  socket.on('telemetry:update', handler)

  return () => {
    socket.off('telemetry:update', handler)
  }
}

export async function subscribeFootstepEvents(
  onEvent: (e: Esp32Payload, key: string) => void,
  onError: (e: Error) => void,
): Promise<() => void> {
  const socket = getSocket()

  const handler = (event: any) => {
    if (!event) return
    const rawPayload: Esp32Payload = {
      deviceId: event.device_id || event.deviceId,
      timestamp: event.timestamp,
      peakVoltage: event.peak_voltage ?? event.features?.peakVoltage ?? 0,
      averageVoltage: event.average_voltage ?? event.features?.averageVoltage ?? 0,
      storageVoltage: event.storage_voltage ?? event.features?.storageVoltage ?? 0,
      pulseDuration: event.pulse_duration_ms ?? event.features?.pulseDuration ?? 100,
      stepInterval: (event.step_interval_ms ?? (event.features?.stepInterval ? event.features.stepInterval * 1000 : 0)) / 1000,
      footstepCount: 1,
      current: null,
      power: null,
      energy: null,
      wifiRssi: -70,
      deviceStatus: 'ONLINE',
      stepClass: event.step_class || event.stepClass,
      confidence: event.confidence,
    }

    const v = validatePayload(rawPayload)
    if (!v.ok) {
      onError(new Error(`Rejected malformed event: ${v.errors.join('; ')}`))
      return
    }
    onEvent(rawPayload, event.id || String(Date.now()))
  }

  socket.on('footstep:detected', handler)

  return () => {
    socket.off('footstep:detected', handler)
  }
}
