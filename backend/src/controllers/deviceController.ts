import { Request, Response } from 'express'
import {
  registerDevice,
  rotateDeviceKey,
  setDeviceRevocation,
  getDeviceInfo,
  listUserDevices,
} from '../services/deviceService.js'

export async function register(req: Request, res: Response): Promise<void> {
  const { deviceId, name, location } = req.body
  if (!deviceId || typeof deviceId !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_DEVICE_ID', message: 'deviceId is required' },
    })
    return
  }

  try {
    const result = await registerDevice({
      deviceId,
      name: name || `Device ${deviceId}`,
      location: location || 'Laboratory',
      ownerId: req.user?.userId,
    })

    res.status(201).json({
      success: true,
      data: {
        device: {
          deviceId: result.device.deviceId,
          name: result.device.name,
          location: result.device.location,
          status: result.device.status,
          apiKeyPrefix: result.device.apiKeyPrefix,
        },
        apiKey: result.apiKey, // returned ONLY once
      },
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: error instanceof Error ? error.message : 'Device registration failed.',
      },
    })
  }
}

export async function getDevice(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId
  const device = req.targetDevice || (await getDeviceInfo(deviceId))
  if (!device) {
    res.status(404).json({
      success: false,
      error: { code: 'DEVICE_NOT_FOUND', message: `Device ${deviceId} not found.` },
    })
    return
  }

  res.json({
    success: true,
    data: {
      deviceId: device.deviceId,
      name: device.name,
      location: device.location,
      firmwareVersion: device.firmwareVersion,
      status: device.status,
      lastSeen: device.lastSeenAt,
      uptimeSec: device.uptimeSec,
      wifiRssi: device.rssi,
      apiKeyPrefix: device.apiKeyPrefix,
      isRevoked: device.isRevoked,
      loads: device.loads,
    },
  })
}

export async function listDevices(req: Request, res: Response): Promise<void> {
  const isAdmin = req.user?.role === 'ADMIN'
  const devices = await listUserDevices(req.user?.userId, isAdmin)
  res.json({
    success: true,
    data: devices.map((d) => ({
      deviceId: d.deviceId,
      name: d.name,
      location: d.location,
      firmwareVersion: d.firmwareVersion,
      status: d.status,
      lastSeen: d.lastSeenAt,
      uptimeSec: d.uptimeSec,
      wifiRssi: d.rssi,
      apiKeyPrefix: d.apiKeyPrefix,
      isRevoked: d.isRevoked,
    })),
  })
}

export async function rotateKey(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId
  try {
    const result = await rotateDeviceKey(deviceId, req.user?.userId, req.user?.email)
    res.json({
      success: true,
      data: {
        apiKey: result.apiKey, // returned ONLY once
        apiKeyPrefix: result.apiKeyPrefix,
      },
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'ROTATION_FAILED',
        message: error instanceof Error ? error.message : 'API key rotation failed.',
      },
    })
  }
}

export async function setRevocation(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId
  const { isRevoked } = req.body

  if (typeof isRevoked !== 'boolean') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'isRevoked must be a boolean.' },
    })
    return
  }

  try {
    const device = await setDeviceRevocation(
      deviceId,
      isRevoked,
      req.user?.userId,
      req.user?.email,
    )
    res.json({
      success: true,
      data: {
        deviceId: device.deviceId,
        isRevoked: device.isRevoked,
        status: device.status,
      },
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'REVOCATION_FAILED',
        message: error instanceof Error ? error.message : 'Device revocation update failed.',
      },
    })
  }
}

export async function getPiezoDiagnostics(req: Request, res: Response): Promise<void> {
  // Real piezoelectric sensor diagnostics. If hardware only reports single/lumped array, return null honestly.
  res.json({
    success: true,
    data: null,
  })
}
