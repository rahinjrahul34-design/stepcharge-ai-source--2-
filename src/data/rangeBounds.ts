import type { HistoryQuery } from './types'

/** Shared range resolution so demo and live windows are always identical. */
export function rangeBoundsLocal(q: HistoryQuery): { from: number; to: number } {
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
