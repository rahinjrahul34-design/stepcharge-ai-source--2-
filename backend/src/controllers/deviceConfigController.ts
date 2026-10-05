import { Request, Response } from 'express'
import {
  getDeviceConfiguration,
  updateDeviceConfiguration,
  reportDeviceConfigStatus,
} from '../services/deviceConfigService.js'
import { getIO } from '../config/socket.js'

export async function getConfig(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId
  try {
    const configData = await getDeviceConfiguration(deviceId)
    if (!configData) {
      res.status(404).json({
        success: false,
        error: { code: 'DEVICE_NOT_FOUND', message: `Device '${deviceId}' not found.` },
      })
      return
    }

    res.json({
      success: true,
      data: configData,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'CONFIG_FETCH_ERROR', message: 'Failed to retrieve device configuration.' },
    })
  }
}

export async function updateConfig(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId
  const updates = req.body

  try {
    const result = await updateDeviceConfiguration(
      deviceId,
      updates,
      req.user?.userId,
      req.user?.email,
    )

    // Notify connected dashboard clients about pending config
    const io = getIO()
    if (io) {
      io.to(`device:${deviceId}`).emit('config:updated', {
        deviceId,
        desired: result.desired,
        syncStatus: 'PENDING',
      })
    }

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'CONFIG_UPDATE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to update device configuration.',
      },
    })
  }
}

export async function reportConfig(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId
  const { appliedVersion, status, rejectionReason } = req.body

  if (typeof appliedVersion !== 'number' || (status !== 'SYNCHRONIZED' && status !== 'REJECTED')) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_CONFIG_REPORT',
        message: "appliedVersion (number) and status ('SYNCHRONIZED' | 'REJECTED') are required.",
      },
    })
    return
  }

  try {
    const updatedStatus = await reportDeviceConfigStatus(
      deviceId,
      appliedVersion,
      status,
      rejectionReason,
    )

    // Broadcast sync status to authorized dashboard room
    const io = getIO()
    if (io) {
      io.to(`device:${deviceId}`).emit('config:statusChanged', {
        deviceId,
        applied: updatedStatus,
      })
    }

    res.json({
      success: true,
      data: updatedStatus,
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'REPORT_CONFIG_FAILED',
        message: error instanceof Error ? error.message : 'Failed to record device configuration status.',
      },
    })
  }
}
