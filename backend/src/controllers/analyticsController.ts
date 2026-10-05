import { Request, Response } from 'express'
import { getFootstepAnalytics, getVoltageTrends } from '../services/analyticsService.js'
import { resolveRangeBounds } from './historyController.js'
import { Device } from '../models/Device.js'

export async function getStats(req: Request, res: Response): Promise<void> {
  const user = req.user
  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    })
    return
  }

  let deviceId = (req.query.deviceId as string) || req.params.deviceId
  if (!deviceId) {
    const firstOwned = await Device.findOne(user.role === 'ADMIN' ? {} : { ownerId: user.userId })
    if (!firstOwned) {
      res.json({ success: true, data: null })
      return
    }
    deviceId = firstOwned.deviceId
  } else {
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
        error: { code: 'ACCESS_DENIED', message: 'You do not have permission to view analytics for this device.' },
      })
      return
    }
  }

  const range = req.query.range as string | undefined
  const customFrom = req.query.from as string | undefined
  const customTo = req.query.to as string | undefined
  const { from, to } = resolveRangeBounds(range, customFrom, customTo)

  try {
    const data = await getFootstepAnalytics({
      deviceId,
      startDate: from,
      endDate: to,
    })

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'ANALYTICS_ERROR', message: 'Failed to aggregate analytics data.' },
    })
  }
}

export async function getTrends(req: Request, res: Response): Promise<void> {
  const user = req.user
  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    })
    return
  }

  let deviceId = (req.query.deviceId as string) || req.params.deviceId
  if (!deviceId) {
    const firstOwned = await Device.findOne(user.role === 'ADMIN' ? {} : { ownerId: user.userId })
    if (!firstOwned) {
      res.json({ success: true, data: [] })
      return
    }
    deviceId = firstOwned.deviceId
  } else {
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
        error: { code: 'ACCESS_DENIED', message: 'You do not have permission to view trends for this device.' },
      })
      return
    }
  }

  const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 500)

  try {
    const trends = await getVoltageTrends(deviceId, limit)
    res.json({
      success: true,
      data: trends,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'TRENDS_ERROR', message: 'Failed to retrieve voltage trends.' },
    })
  }
}
