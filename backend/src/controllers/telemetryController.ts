import { Request, Response } from 'express'
import {
  validateTelemetryPayload,
  processTelemetry,
  getLatestTelemetry,
} from '../services/telemetryService.js'

export async function postTelemetry(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId || req.body?.deviceId
  const payload = { ...req.body, deviceId }

  const validation = validateTelemetryPayload(payload)
  if (!validation.ok) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_TELEMETRY',
        message: `Validation failed: ${validation.errors.join('; ')}`,
      },
    })
    return
  }

  try {
    const doc = await processTelemetry(payload, req.ip)
    res.status(201).json({
      success: true,
      data: {
        id: doc._id,
        deviceId: doc.deviceId,
        timestamp: doc.timestamp,
        storageVoltage: doc.storageVoltage,
        estimatedStoredEnergy: doc.estimatedStoredEnergy,
      },
    })
  } catch (error) {
    console.error('[Telemetry] Ingestion error:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 'TELEMETRY_STORAGE_ERROR',
        message: 'Failed to record telemetry packet.',
      },
    })
  }
}

export async function getLatest(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId
  try {
    const latest = await getLatestTelemetry(deviceId)
    if (!latest) {
      res.json({ success: true, data: null })
      return
    }

    res.json({
      success: true,
      data: {
        timestamp: latest.timestamp.toISOString(),
        deviceId: latest.deviceId,
        footstepCount: latest.footstepCount,
        peakVoltage: latest.peakVoltage,
        averageVoltage: latest.averageVoltage,
        storageVoltage: latest.storageVoltage,
        pulseDuration: latest.pulseDuration,
        stepInterval: latest.stepInterval,
        current: latest.current,
        power: latest.power,
        energy: latest.energy,
        estimatedStoredEnergy: latest.estimatedStoredEnergy,
        wifiRssi: latest.wifiRssi,
        deviceStatus: latest.deviceStatus,
        firmwareVersion: latest.firmwareVersion,
        loadControlAvailable: latest.loadControlAvailable,
        stepClass: latest.stepClass,
        confidence: latest.confidence,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'QUERY_ERROR', message: 'Failed to fetch latest telemetry.' },
    })
  }
}
