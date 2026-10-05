import { Alert, IAlert, AlertSeverity, AlertCategory } from '../models/Alert.js'
import { emitAlertCreated, emitAlertResolved } from '../config/socket.js'

export async function createAlert(params: {
  deviceId: string
  userId?: string
  category: AlertCategory
  type: string
  title: string
  reason?: string
  severity: AlertSeverity
  currentValue?: string
  threshold?: string
  action?: string
}): Promise<IAlert> {
  const alert = await Alert.create({
    deviceId: params.deviceId,
    userId: params.userId,
    category: params.category,
    type: params.type,
    title: params.title,
    reason: params.reason || '',
    severity: params.severity,
    currentValue: params.currentValue || '',
    threshold: params.threshold || '',
    action: params.action || '',
    resolved: false,
  })

  emitAlertCreated(alert)
  return alert
}

export async function listAlerts(deviceFilter?: string | string[], limit = 60): Promise<IAlert[]> {
  const filter: Record<string, unknown> = {}
  if (Array.isArray(deviceFilter)) {
    filter.deviceId = { $in: deviceFilter }
  } else if (deviceFilter) {
    filter.deviceId = deviceFilter
  }
  return Alert.find(filter).sort({ createdAt: -1 }).limit(limit)
}

export async function resolveAlert(alertId: string, userId?: string): Promise<IAlert | null> {
  const alert = await Alert.findByIdAndUpdate(
    alertId,
    {
      $set: {
        resolved: true,
        resolvedAt: new Date(),
        ...(userId ? { resolvedBy: userId } : {}),
      },
    },
    { new: true },
  )

  if (alert) {
    emitAlertResolved(alert)
  }
  return alert
}
