import { Request, Response, NextFunction } from 'express'
import { Device, IDevice } from '../models/Device.js'
import { requireAuth } from './auth.js'
import { requireDeviceAuth } from './deviceAuth.js'
import { config } from '../config/env.js'

declare global {
  namespace Express {
    interface Request {
      targetDevice?: IDevice
    }
  }
}

/**
 * Reusable Device Ownership Authorization Middleware
 *
 * Enforces Phase 4 and Phase 5 security:
 * - ADMIN can access any device.
 * - Normal USER can ONLY access devices they own (device.ownerId === req.user.userId).
 * - Rejects unauthorized requests with 403 Forbidden.
 */
export async function requireDeviceAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  const deviceId = req.params.deviceId || (req.query.deviceId as string) || req.body?.deviceId

  if (!deviceId || typeof deviceId !== 'string') {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_DEVICE_ID',
        message: 'A valid deviceId is required for this operation.',
      },
    })
    return
  }

  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication session required.',
      },
    })
    return
  }

  try {
    const device = await Device.findOne({ deviceId: deviceId.trim() })
    if (!device) {
      res.status(404).json({
        success: false,
        error: {
          code: 'DEVICE_NOT_FOUND',
          message: `Device '${deviceId}' not found.`,
        },
      })
      return
    }

    // ADMIN has full administrative access across all devices
    if (req.user.role === 'ADMIN') {
      req.targetDevice = device
      return next()
    }

    // Normal USER must be the explicit owner of this device
    const isOwner = device.ownerId && device.ownerId.toString() === req.user.userId.toString()
    if (!isOwner) {
      res.status(403).json({
        success: false,
        error: {
          code: 'DEVICE_ACCESS_DENIED',
          message: 'You do not have authorization to access or control this device.',
        },
      })
      return
    }

    req.targetDevice = device
    next()
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTHORIZATION_ERROR',
        message: 'Internal error validating device ownership.',
      },
    })
  }
}

/**
 * Composite authorization for endpoints accessible by either the physical ESP32
 * (using X-Device-Key) or the dashboard user owning the device (using session cookie).
 */
export async function requireDeviceOrOwnerAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const hasDeviceKey =
    req.headers['x-device-key'] ||
    (req.headers.authorization?.startsWith('Bearer ') && !req.cookies?.[config.sessionCookieName])

  if (hasDeviceKey) {
    return requireDeviceAuth(req, res, next)
  }

  return requireAuth(req, res, () => {
    requireDeviceAccess(req, res, next)
  })
}
