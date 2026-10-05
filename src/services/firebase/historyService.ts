import type { Esp32Payload, FootstepEvent, HistoryQuery } from '../../data/types'
import { deviceId, getDb, paths } from './config'
import { eventFromPayload, validatePayload } from './telemetryService'

/** Resolves a range key into absolute epoch bounds. */
export function rangeBounds(q: HistoryQuery): { from: number; to: number } {
  const now = Date.now()
  const startOfToday = new Date(now).setHours(0, 0, 0, 0)
  switch (q.range) {
    case 'yesterday':
      return { from: startOfToday - 864e5, to: startOfToday }
    case '7d':
      return { from: startOfToday - 6 * 864e5, to: now }
    case '30d':
      return { from: startOfToday - 29 * 864e5, to: now }
    case 'custom':
      return q.custom
        ? { from: +new Date(q.custom.from), to: +new Date(q.custom.to) + 864e5 - 1 }
        : { from: startOfToday, to: now }
    default:
      return { from: startOfToday, to: now }
  }
}

/**
 * Server-side bounded query — never pulls the whole table.
 * Events are stored under keys that sort by time (epoch ms), so
 * orderByKey + startAt/endAt is an indexed range scan.
 */
export async function queryEvents(q: HistoryQuery): Promise<FootstepEvent[]> {
  const db = await getDb()
  const { ref, query, orderByKey, startAt, endAt, limitToLast, get } = await import('firebase/database')
  const { from, to } = rangeBounds(q)
  const snap = await get(
    query(
      ref(db, paths.events(deviceId())),
      orderByKey(),
      startAt(String(from)),
      endAt(String(to)),
      limitToLast(q.limit ?? 2000),
    ),
  )
  if (!snap.exists()) return []
  const out: FootstepEvent[] = []
  snap.forEach((child) => {
    const raw = child.val()
    if (validatePayload(raw).ok) out.push(eventFromPayload(raw as Esp32Payload, child.key ?? ''))
  })
  return out
}
