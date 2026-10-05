import type { AlertItem } from '../../data/types'
import { getDb, paths } from './config'

export async function subscribeAlerts(
  onAlerts: (a: AlertItem[]) => void,
  onError: (e: Error) => void,
): Promise<() => void> {
  const db = await getDb()
  const { ref, query, limitToLast, onValue } = await import('firebase/database')
  return onValue(
    query(ref(db, paths.alerts()), limitToLast(60)),
    (snap) => {
      const val = (snap.val() as Record<string, AlertItem> | null) ?? {}
      onAlerts(
        Object.entries(val)
          .map(([id, a]) => ({ ...a, id }))
          .sort((x, y) => +new Date(y.timestamp) - +new Date(x.timestamp)),
      )
    },
    (e) => onError(e as Error),
  )
}

/** Alerts raised by the dashboard's own rule engine are persisted for the record. */
export async function pushAlert(alert: AlertItem): Promise<void> {
  const db = await getDb()
  const { ref, push, set } = await import('firebase/database')
  await set(push(ref(db, paths.alerts())), alert)
}

export async function resolveAlert(id: string): Promise<void> {
  const db = await getDb()
  const { ref, update } = await import('firebase/database')
  await update(ref(db, `${paths.alerts()}/${id}`), { resolved: true })
}
