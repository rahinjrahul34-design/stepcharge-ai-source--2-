import type { LoadKey, LoadMap } from '../../data/types'
import { EMPTY_LOADS } from '../../data/types'
import { deviceId, getDb, paths } from './config'

/**
 * Load control — the full chain is:
 *
 *   Dashboard → loads/{key}/command (Firebase)
 *             → ESP32 reads command
 *             → GPIO / MOSFET switches
 *             → ESP32 writes loads/{key}/actualState back
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
      // Tolerate legacy firmware that wrote a bare boolean.
      out[k] = { command: v, actualState: null }
    }
  }
  return out
}

export async function subscribeLoads(
  onLoads: (l: LoadMap) => void,
  onError: (e: Error) => void,
): Promise<() => void> {
  const db = await getDb()
  const { ref, onValue } = await import('firebase/database')
  return onValue(
    ref(db, paths.loads(deviceId())),
    (snap) => onLoads(coerce(snap.val())),
    (e) => onError(e as Error),
  )
}

export async function writeLoadCommand(load: LoadKey, on: boolean): Promise<void> {
  const db = await getDb()
  const { ref, update } = await import('firebase/database')
  await update(ref(db, `${paths.loads(deviceId())}/${load}`), {
    command: on,
    updatedAt: new Date().toISOString(),
  })
}
