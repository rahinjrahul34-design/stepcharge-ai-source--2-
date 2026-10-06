import type { AlertItem } from '../../data/types'
import { deviceId, fetchApi } from './client'
import { getSocket } from './socket'

let cachedAlerts: AlertItem[] = []

export async function subscribeAlerts(
  onAlerts: (a: AlertItem[]) => void,
  onError: (e: Error) => void,
): Promise<() => void> {
  const socket = getSocket()

  // Initial fetch
  fetchApi<AlertItem[]>('/alerts')
    .then((list) => {
      cachedAlerts = list || []
      onAlerts(cachedAlerts)
    })
    .catch((e) => onError(e as Error))

  const handleCreated = (alert: any) => {
    const formatted: AlertItem = {
      id: alert.id || alert._id,
      timestamp: alert.timestamp || alert.createdAt || new Date().toISOString(),
      category: alert.category,
      severity: alert.severity,
      title: alert.title,
      reason: alert.reason,
      currentValue: alert.currentValue,
      threshold: alert.threshold,
      action: alert.action,
      resolved: alert.resolved,
      read: Boolean(alert.read),
    }
    cachedAlerts = [formatted, ...cachedAlerts.filter((a) => a.id !== formatted.id)].slice(0, 60)
    onAlerts(cachedAlerts)
  }

  const handleResolved = (alert: any) => {
    const id = alert.id || alert._id
    cachedAlerts = cachedAlerts.map((a) => (a.id === id ? { ...a, resolved: true } : a))
    onAlerts(cachedAlerts)
  }

  socket.on('alert:created', handleCreated)
  socket.on('alert:resolved', handleResolved)
  const handleUpdated = (alert: any) => {
    const id = alert.id || alert._id
    cachedAlerts = cachedAlerts.map((a) => (a.id === id ? { ...a, read: Boolean(alert.read) } : a))
    onAlerts(cachedAlerts)
  }
  socket.on('alert:updated', handleUpdated)

  return () => {
    socket.off('alert:created', handleCreated)
    socket.off('alert:resolved', handleResolved)
    socket.off('alert:updated', handleUpdated)
  }
}

export async function pushAlert(alert: AlertItem): Promise<void> {
  await fetchApi('/alerts', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: deviceId(),
      ...alert,
    }),
  }).catch(() => {})
}

export async function resolveAlert(id: string): Promise<void> {
  await fetchApi(`/alerts/${id}/resolve`, {
    method: 'POST',
  })
}

export async function markAlertRead(id: string): Promise<void> {
  await fetchApi(`/alerts/${encodeURIComponent(id)}/read`, { method: 'PATCH' })
}

export async function markAllAlertsRead(): Promise<void> {
  await fetchApi('/alerts/read-all', { method: 'POST' })
}
