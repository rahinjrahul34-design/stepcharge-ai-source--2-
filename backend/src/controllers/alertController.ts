import { Request, Response } from 'express'
import { listAlerts, resolveAlert, createAlert } from '../services/alertService.js'
import { Device } from '../models/Device.js'
import { Alert } from '../models/Alert.js'

export async function getAlerts(req: Request, res: Response): Promise<void> {
  const user = req.user
  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    })
    return
  }

  const deviceId = req.query.deviceId as string | undefined
  const limit = parseInt((req.query.limit as string) || '60', 10)

  try {
    let deviceFilter: string | string[] | undefined = deviceId

    if (deviceId) {
      const device = await Device.findOne({ deviceId: deviceId.trim() })
      if (!device) {
        res.status(404).json({
          success: false,
          error: { code: 'DEVICE_NOT_FOUND', message: `Device '${deviceId}' not found.` },
        })
        return
      }

      const isOwner = device.ownerId && device.ownerId.toString() === user.userId
      const isAdmin = user.role === 'ADMIN'
      if (!isOwner && !isAdmin) {
        res.status(403).json({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'You do not have permission to view alerts for this device.' },
        })
        return
      }
    } else if (user.role !== 'ADMIN') {
      const owned = await Device.find({ ownerId: user.userId }).distinct('deviceId')
      deviceFilter = owned
    }

    const alerts = await listAlerts(deviceFilter, Math.min(limit, 200))
    res.json({
      success: true,
      data: alerts.map((a) => ({
        id: a._id.toString(),
        deviceId: a.deviceId,
        category: a.category,
        type: a.type,
        title: a.title,
        reason: a.reason,
        severity: a.severity,
        currentValue: a.currentValue,
        threshold: a.threshold,
        action: a.action,
        resolved: a.resolved,
        timestamp: a.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'QUERY_ERROR', message: 'Failed to retrieve alerts.' },
    })
  }
}

export async function resolve(req: Request, res: Response): Promise<void> {
  const user = req.user
  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    })
    return
  }

  const alertId = req.params.alertId

  try {
    const alert = await Alert.findById(alertId)
    if (!alert) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Alert not found.' },
      })
      return
    }

    // Verify ownership of the alert's device
    if (user.role !== 'ADMIN') {
      const device = await Device.findOne({ deviceId: alert.deviceId })
      const isOwner = device && device.ownerId && device.ownerId.toString() === user.userId
      if (!isOwner) {
        res.status(403).json({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'You do not have permission to resolve alerts for this device.' },
        })
        return
      }
    }

    const updated = await resolveAlert(alertId, user.userId)
    res.json({
      success: true,
      data: {
        id: updated!._id.toString(),
        resolved: updated!.resolved,
        resolvedAt: updated!.resolvedAt,
      },
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'RESOLVE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to resolve alert.',
      },
    })
  }
}

export async function createManualAlert(req: Request, res: Response): Promise<void> {
  const { deviceId, category, type, title, reason, severity, currentValue, threshold, action } =
    req.body

  if (!deviceId || !type || !title || !severity) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_FIELDS',
        message: 'deviceId, type, title, and severity are required.',
      },
    })
    return
  }

  try {
    const alert = await createAlert({
      deviceId,
      userId: req.user?.userId,
      category: category || 'SYSTEM',
      type,
      title,
      reason,
      severity,
      currentValue,
      threshold,
      action,
    })

    res.status(201).json({
      success: true,
      data: alert,
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'CREATE_ALERT_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create alert.',
      },
    })
  }
}
