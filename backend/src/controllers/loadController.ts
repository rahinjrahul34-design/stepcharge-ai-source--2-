import { Request, Response } from 'express'
import {
  setLoadCommand,
  reportActualLoadState,
  getDeviceLoads,
  LoadKey,
} from '../services/loadControlService.js'

export async function setCommand(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId
  const { load, command } = req.body

  if (load !== 'led' && load !== 'fan') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_LOAD', message: "Load must be 'led' or 'fan'." },
    })
    return
  }

  if (typeof command !== 'boolean') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_COMMAND', message: 'Command must be a boolean.' },
    })
    return
  }

  try {
    const result = await setLoadCommand(
      deviceId,
      load as LoadKey,
      command,
      req.user?.userId,
      req.user?.email,
    )
    res.json({
      success: true,
      data: result.loads,
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'LOAD_COMMAND_FAILED',
        message: error instanceof Error ? error.message : 'Failed to set load command.',
      },
    })
  }
}

export async function reportActual(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId
  const { load, actualState, reportedAt } = req.body

  if (load !== 'led' && load !== 'fan') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_LOAD', message: "Load must be 'led' or 'fan'." },
    })
    return
  }

  if (typeof actualState !== 'boolean') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_ACTUAL_STATE', message: 'actualState must be a boolean.' },
    })
    return
  }

  try {
    const result = await reportActualLoadState(
      deviceId,
      load as LoadKey,
      actualState,
      reportedAt,
    )
    res.json({
      success: true,
      data: result.loads,
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'REPORT_ACTUAL_FAILED',
        message: error instanceof Error ? error.message : 'Failed to record actual load state.',
      },
    })
  }
}

export async function getLoads(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId
  try {
    const loads = await getDeviceLoads(deviceId)
    res.json({
      success: true,
      data: loads,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'QUERY_ERROR', message: 'Failed to retrieve load states.' },
    })
  }
}
