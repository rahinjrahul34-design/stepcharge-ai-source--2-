import type { DeviceInfo, ModelMetadata, PiezoSensor } from '../../data/types'
import { deviceId, getDb, paths } from './config'

export interface DeviceRecord {
  deviceId: string
  name?: string
  status?: string
  firmwareVersion?: string
  lastSeen?: string
  wifiRssi?: number
  uptimeSec?: number
  packetsReceived?: number
  packetsLost?: number
  latencyMs?: number
}

/** Normalises the devices/{id} record; unknown fields stay null rather than faked. */
export function toDeviceInfo(raw: DeviceRecord | null, fallbackId: string): DeviceInfo | null {
  if (!raw) return null
  return {
    deviceId: raw.deviceId ?? fallbackId,
    name: raw.name ?? 'Unnamed device',
    location: (raw as { location?: string }).location ?? 'Not set',
    firmwareVersion: raw.firmwareVersion ?? 'unknown',
    status: (raw.status as DeviceInfo['status']) ?? 'OFFLINE',
    lastSeen: raw.lastSeen ?? null,
    uptimeSec: typeof raw.uptimeSec === 'number' ? raw.uptimeSec : null,
    wifiRssi: typeof raw.wifiRssi === 'number' ? raw.wifiRssi : null,
  }
}

export async function subscribeDevice(
  onDevice: (d: DeviceInfo | null) => void,
  onError: (e: Error) => void,
): Promise<() => void> {
  const db = await getDb()
  const { ref, onValue } = await import('firebase/database')
  const r = ref(db, paths.device(deviceId()))
  return onValue(
    r,
    (snap) => onDevice(toDeviceInfo(snap.val() as DeviceRecord | null, deviceId())),
    (e) => onError(e as Error),
  )
}

/** Device registration — writes only descriptive metadata, never secrets. */
export async function registerDevice(info: Pick<DeviceInfo, 'name' | 'location'>): Promise<void> {
  const db = await getDb()
  const { ref, update } = await import('firebase/database')
  await update(ref(db, paths.device(deviceId())), { ...info, deviceId: deviceId() })
}

/**
 * Per-element piezo diagnostics. Returns null when the firmware does not
 * publish them — the UI then shows "Individual sensor diagnostics unavailable"
 * rather than inventing per-sensor health.
 */
export async function fetchPiezoArray(): Promise<PiezoSensor[] | null> {
  const db = await getDb()
  const { ref, get } = await import('firebase/database')
  const snap = await get(ref(db, paths.piezo(deviceId())))
  if (!snap.exists()) return null
  const val = snap.val() as Record<string, Omit<PiezoSensor, 'id' | 'index'>>
  return Object.entries(val).map(([k, v], i) => ({ id: k, index: i + 1, ...v }))
}

/** Model metadata published by the training pipeline, if it writes to Firebase. */
export async function fetchModelMetadata(): Promise<ModelMetadata | null> {
  const db = await getDb()
  const { ref, get } = await import('firebase/database')
  const snap = await get(ref(db, paths.model()))
  if (!snap.exists()) return null
  return { ...(snap.val() as ModelMetadata), connected: true, source: 'api' }
}
