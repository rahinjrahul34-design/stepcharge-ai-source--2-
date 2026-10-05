import type { DeviceInfo, ModelMetadata, PiezoSensor } from '../../data/types'
import { deviceId, fetchApi } from './client'
import { getSocket } from './socket'

export interface DeviceRecord {
  deviceId: string
  name?: string
  location?: string
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
    location: raw.location ?? 'Not set',
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
  const socket = getSocket()

  // Initial fetch
  fetchApi<DeviceRecord>(`/devices/${deviceId()}`)
    .then((raw) => onDevice(toDeviceInfo(raw, deviceId())))
    .catch((e) => onError(e as Error))

  const handler = (data: any) => {
    onDevice(toDeviceInfo(data as DeviceRecord, deviceId()))
  }

  socket.on('device:status', handler)

  return () => {
    socket.off('device:status', handler)
  }
}

/** Device registration — writes only descriptive metadata, never secrets. */
export async function registerDevice(info: Pick<DeviceInfo, 'name' | 'location'>): Promise<void> {
  await fetchApi('/devices', {
    method: 'POST',
    body: JSON.stringify({ ...info, deviceId: deviceId() }),
  })
}

/**
 * Per-element piezo diagnostics. Returns null when the firmware does not
 * publish them — the UI then shows "Individual sensor diagnostics unavailable"
 * rather than inventing per-sensor health.
 */
export async function fetchPiezoArray(): Promise<PiezoSensor[] | null> {
  try {
    const data = await fetchApi<PiezoSensor[] | null>(`/devices/${deviceId()}/piezo`)
    return data
  } catch {
    return null
  }
}

/** Model metadata published by the ML microservice or stored in MongoDB. */
export async function fetchModelMetadata(): Promise<ModelMetadata | null> {
  try {
    const data = await fetchApi<ModelMetadata>('/ml/model')
    return { ...data, connected: true, source: 'api' }
  } catch {
    return null
  }
}
