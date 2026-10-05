import { Request, Response } from 'express'
import { Footstep } from '../models/Footstep.js'
import { Telemetry } from '../models/Telemetry.js'
import { Device } from '../models/Device.js'

export function resolveRangeBounds(range?: string, customFrom?: string, customTo?: string): { from: Date; to: Date } {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (range) {
    case 'yesterday': {
      const from = new Date(startOfToday.getTime() - 864e5)
      const to = startOfToday
      return { from, to }
    }
    case '7d': {
      const from = new Date(startOfToday.getTime() - 6 * 864e5)
      return { from, to: now }
    }
    case '30d': {
      const from = new Date(startOfToday.getTime() - 29 * 864e5)
      return { from, to: now }
    }
    case 'custom': {
      const from = customFrom ? new Date(customFrom) : startOfToday
      const to = customTo ? new Date(new Date(customTo).getTime() + 864e5 - 1) : now
      return { from, to }
    }
    case 'today':
    default:
      return { from: startOfToday, to: now }
  }
}

export async function queryFootstepHistory(req: Request, res: Response): Promise<void> {
  const deviceId = (req.query.deviceId as string) || req.params.deviceId
  const range = req.query.range as string | undefined
  const customFrom = req.query.from as string | undefined
  const customTo = req.query.to as string | undefined
  const stepClass = req.query.stepClass as string | undefined
  const limit = Math.min(parseInt((req.query.limit as string) || '2000', 10), 5000)

  const { from, to } = resolveRangeBounds(range, customFrom, customTo)

  const filter: Record<string, unknown> = {
    timestamp: { $gte: from, $lte: to },
  }

  const user = req.user
  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    })
    return
  }

  // Phase 10: Ownership Authorization
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
        error: { code: 'ACCESS_DENIED', message: 'You do not have permission to view history for this device.' },
      })
      return
    }
    filter.deviceId = device.deviceId
  } else if (user.role !== 'ADMIN') {
    // Scope to owned devices only
    const owned = await Device.find({ ownerId: user.userId }).distinct('deviceId')
    filter.deviceId = { $in: owned }
  }

  if (stepClass && stepClass !== 'ALL') filter.stepClass = stepClass

  try {
    const footsteps = await Footstep.find(filter)
      .sort({ timestamp: 1 })
      .limit(limit)
      .lean()

    res.json({
      success: true,
      data: footsteps.map((f) => ({
        id: f._id.toString(),
        timestamp: f.timestamp.toISOString(),
        device_id: f.deviceId,
        features: f.features,
        step_class: f.stepClass,
        confidence: f.confidence,
        prediction_source: f.predictionSource,
        peak_voltage: f.features.peakVoltage,
        pulse_duration_ms: f.features.pulseDuration,
        step_interval_ms: Math.round((f.features.stepInterval ?? 0) * 1000),
        storage_voltage: f.features.storageVoltage,
        estimated_energy_j: f.estimatedEnergyJ,
        source: 'live',
      })),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'QUERY_ERROR', message: 'Failed to query footstep history.' },
    })
  }
}

export async function queryTelemetryHistory(req: Request, res: Response): Promise<void> {
  const deviceId = (req.query.deviceId as string) || req.params.deviceId
  const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 1000)

  const filter: Record<string, unknown> = {}

  const user = req.user
  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    })
    return
  }

  // Phase 10: Ownership Authorization
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
        error: { code: 'ACCESS_DENIED', message: 'You do not have permission to view history for this device.' },
      })
      return
    }
    filter.deviceId = device.deviceId
  } else if (user.role !== 'ADMIN') {
    const owned = await Device.find({ ownerId: user.userId }).distinct('deviceId')
    filter.deviceId = { $in: owned }
  }

  try {
    const records = await Telemetry.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean()

    res.json({
      success: true,
      data: records.reverse().map((r) => ({
        timestamp: r.timestamp.toISOString(),
        deviceId: r.deviceId,
        peakVoltage: r.peakVoltage,
        averageVoltage: r.averageVoltage,
        storageVoltage: r.storageVoltage,
        footstepCount: r.footstepCount,
        pulseDuration: r.pulseDuration,
        stepInterval: r.stepInterval,
        estimatedEnergyJ: r.estimatedStoredEnergy,
        deviceStatus: r.deviceStatus,
      })),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'QUERY_ERROR', message: 'Failed to query telemetry history.' },
    })
  }
}
