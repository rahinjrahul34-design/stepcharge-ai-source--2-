import { Request, Response } from 'express'
import {
  calibrateVoltage,
  calibrateCurrent,
  calibratePiezoThresholds,
  getCalibrationLogs,
} from '../services/calibrationService.js'

export async function calibrateVoltageHandler(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId
  const { referenceVoltage, measuredVoltage, apply } = req.body

  if (typeof referenceVoltage !== 'number' || typeof measuredVoltage !== 'number') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'referenceVoltage and measuredVoltage numbers are required.' },
    })
    return
  }

  try {
    const result = await calibrateVoltage(
      deviceId,
      { referenceVoltage, measuredVoltage, apply: Boolean(apply) },
      req.user!.userId,
      req.user!.email,
    )
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'CALIBRATION_FAILED',
        message: error instanceof Error ? error.message : 'Voltage calibration failed.',
      },
    })
  }
}

export async function calibrateCurrentHandler(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId
  const { referenceCurrentMa, measuredCurrentMa, apply } = req.body

  if (typeof referenceCurrentMa !== 'number' || typeof measuredCurrentMa !== 'number') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'referenceCurrentMa and measuredCurrentMa numbers are required.' },
    })
    return
  }

  try {
    const result = await calibrateCurrent(
      deviceId,
      { referenceCurrentMa, measuredCurrentMa, apply: Boolean(apply) },
      req.user!.userId,
      req.user!.email,
    )
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'CALIBRATION_FAILED',
        message: error instanceof Error ? error.message : 'Current calibration failed.',
      },
    })
  }
}

export async function calibratePiezoHandler(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId
  const { baselineNoiseV, lightStepPeakV, apply } = req.body

  if (typeof baselineNoiseV !== 'number' || typeof lightStepPeakV !== 'number') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'baselineNoiseV and lightStepPeakV numbers are required.' },
    })
    return
  }

  try {
    const result = await calibratePiezoThresholds(
      deviceId,
      {
        baselineNoiseV,
        lightStepPeakV,
        normalStepPeakV: req.body.normalStepPeakV || lightStepPeakV * 1.5,
        heavyStepPeakV: req.body.heavyStepPeakV || lightStepPeakV * 2.5,
        apply: Boolean(apply),
      },
      req.user!.userId,
      req.user!.email,
    )
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'CALIBRATION_FAILED',
        message: error instanceof Error ? error.message : 'Piezo threshold calibration failed.',
      },
    })
  }
}

export async function getCalibrationLogsHandler(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId
  try {
    const logs = await getCalibrationLogs(deviceId)
    res.json({ success: true, data: logs })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'QUERY_ERROR', message: 'Failed to retrieve calibration logs.' },
    })
  }
}
