import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { Device, IDevice } from '../models/Device.js'
import { isDbConnected } from '../config/database.js'

import { config } from '../config/env.js'

declare global {
  namespace Express {
    interface Request {
      device?: IDevice
    }
  }
}

export function hashDeviceKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex')
}

export async function requireDeviceAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const rawDeviceId = req.params.deviceId || (req.headers['x-device-id'] as string) || req.body?.deviceId
  const deviceId = typeof rawDeviceId === 'string' ? rawDeviceId.trim() : ''

  if (!deviceId) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_DEVICE_ID',
        message: 'A valid deviceId must be provided in the request parameters, headers, or body.',
      },
    })
    return
  }

  const rawKey =
    (req.headers['x-device-key'] as string) ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7).trim() : null)

  if (!isDbConnected()) {
    res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database connection is currently unavailable.',
      },
    })
    return
  }

  try {
    let device = await Device.findOne({ deviceId }).select('+apiKeyHash')

    if (!device) {
      // Auto-provision ONLY if explicitly enabled in non-production development environments
      if (!config.isProd && config.deviceAutoProvision && rawKey) {
        const keyHash = hashDeviceKey(rawKey)
        device = await Device.create({
          deviceId,
          name: `StepCharge Mat (${deviceId})`,
          location: 'Dev-Auto-Provisioned',
          status: 'ONLINE',
          apiKeyHash: keyHash,
          apiKeyPrefix: rawKey.slice(0, 8),
          lastSeenAt: new Date(),
          lastIp: req.ip,
        })
        req.device = device
        return next()
      }

      // Production strictly refuses auto-provisioning
      res.status(403).json({
        success: false,
        error: {
          code: 'DEVICE_NOT_REGISTERED',
          message: `Device '${deviceId}' is not registered. Please register the device with an administrator before sending telemetry.`,
        },
      })
      return
    }

    if (device.isRevoked) {
      res.status(403).json({
        success: false,
        error: {
          code: 'DEVICE_REVOKED',
          message: 'This device access credential has been revoked by an administrator.',
        },
      })
      return
    }

    // Require device authentication key verification
    if (!rawKey) {
      res.status(401).json({
        success: false,
        error: {
          code: 'DEVICE_UNAUTHORIZED',
          message: 'Device authentication key is required (header: X-Device-Key).',
        },
      })
      return
    }

    if (!device.apiKeyHash) {
      res.status(401).json({
        success: false,
        error: {
          code: 'DEVICE_NOT_PROVISIONED',
          message: 'Device does not have a provisioned authentication key. Please rotate/provision via admin.',
        },
      })
      return
    }

    const incomingHash = hashDeviceKey(rawKey)
    if (incomingHash !== device.apiKeyHash) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INVALID_DEVICE_KEY',
          message: 'Invalid device authentication key.',
        },
      })
      return
    }

    // Attach verified device document
    req.device = device
    next()
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DEVICE_AUTH_ERROR',
        message: 'Internal error verifying device authorization.',
      },
    })
  }
}
