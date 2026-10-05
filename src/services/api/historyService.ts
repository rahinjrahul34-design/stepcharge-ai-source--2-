import type { FootstepEvent, HistoryQuery } from '../../data/types'
import { deviceId, fetchApi } from './client'

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
 * Server-side bounded query to MongoDB — never downloads huge tables into the browser.
 */
export async function queryEvents(q: HistoryQuery): Promise<FootstepEvent[]> {
  const params = new URLSearchParams()
  if (q.range) params.set('range', q.range)
  if (q.custom?.from) params.set('from', q.custom.from)
  if (q.custom?.to) params.set('to', q.custom.to)
  if (q.limit) params.set('limit', String(q.limit))

  try {
    const data = await fetchApi<FootstepEvent[]>(`/history/devices/${deviceId()}/footsteps?${params.toString()}`)
    return data || []
  } catch (error) {
    console.warn('[History] Query failed:', error)
    return []
  }
}
