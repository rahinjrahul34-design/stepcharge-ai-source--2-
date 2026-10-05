import type { LoadKey, LoadMap } from '../../data/types'
import { EMPTY_LOADS } from '../../data/types'
import { deviceId, fetchApi } from './client'
import { getSocket } from './socket'

/**
 * Load control — the full chain is:
 *
 *   Dashboard → POST /api/devices/{id}/load-command (Backend)
 *             → ESP32 polls commands
 *             → GPIO / MOSFET switches
 *             → ESP32 reports actual state to /api/devices/{id}/load-state
 *             → Socket.IO emits load:stateChanged
 *             → Dashboard shows COMMAND vs ACTUAL
 *
 * The browser only ever writes `command`. It must never write `actualState`,
 * because only the firmware knows what the GPIO really did. If the device is
 * offline the command is stored but `actualState` stays stale/null, and the UI
 * reports DEVICE OFFLINE instead of claiming the load switched.
 */

function coerce(raw: unknown): LoadMap {
  const out: LoadMap = { led: { ...EMPTY_LOADS.led }, fan: { ...EMPTY_LOADS.fan } }
  if (typeof raw !== 'object' || raw === null) return out
  const o = raw as Record<string, unknown>
  for (const k of ['led', 'fan'] as LoadKey[]) {
    const v = o[k]
    if (typeof v === 'object' && v !== null) {
      const r = v as Record<string, unknown>
      out[k] = {
        command: Boolean(r.command),
        actualState: typeof r.actualState === 'boolean' ? r.actualState : null,
        updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
        reportedAt: typeof r.reportedAt === 'string' ? r.reportedAt : undefined,
      }
    } else if (typeof v === 'boolean') {
      out[k] = { command: v, actualState: null }
    }
  }
  return out
}

export async function subscribeLoads(
  onLoads: (l: LoadMap) => void,
  onError: (e: Error) => void,
): Promise<() => void> {
  const socket = getSocket()

  // Initial fetch
  fetchApi<unknown>(`/devices/${deviceId()}/loads`)
    .then((raw) => onLoads(coerce(raw)))
    .catch((e) => onError(e as Error))

  const handler = (raw: any) => {
    onLoads(coerce(raw))
  }

  socket.on('load:stateChanged', handler)

  return () => {
    socket.off('load:stateChanged', handler)
  }
}

export async function writeLoadCommand(load: LoadKey, on: boolean): Promise<void> {
  await fetchApi(`/devices/${deviceId()}/load-command`, {
    method: 'POST',
    body: JSON.stringify({ load, command: on }),
  })
}
