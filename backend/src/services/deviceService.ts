import crypto from 'crypto'
import { Device, IDevice } from '../models/Device.js'
import { hashDeviceKey } from '../middlewares/deviceAuth.js'
import { AuditLog } from '../models/AuditLog.js'

export function generateApiKey(): string {
  const random = crypto.randomBytes(24).toString('hex')
  return `sc_live_${random}`
}

export async function registerDevice(params: {
  deviceId: string
  name: string
  location: string
  ownerId?: string
}): Promise<{ device: IDevice; apiKey: string }> {
  const existing = await Device.findOne({ deviceId: params.deviceId })
  if (existing) {
    throw new Error(`Device ${params.deviceId} is already registered.`)
  }

  const apiKey = generateApiKey()
  const apiKeyHash = hashDeviceKey(apiKey)
  const apiKeyPrefix = apiKey.slice(0, 12)

  const device = await Device.create({
    deviceId: params.deviceId,
    name: params.name,
    location: params.location,
    ownerId: params.ownerId,
    apiKeyHash,
    apiKeyPrefix,
    status: 'OFFLINE',
  })

  return { device, apiKey }
}

export async function rotateDeviceKey(
  deviceId: string,
  userId?: string,
  userEmail?: string,
): Promise<{ apiKey: string; apiKeyPrefix: string }> {
  const device = await Device.findOne({ deviceId })
  if (!device) {
    throw new Error(`Device ${deviceId} not found.`)
  }

  const apiKey = generateApiKey()
  device.apiKeyHash = hashDeviceKey(apiKey)
  device.apiKeyPrefix = apiKey.slice(0, 12)
  await device.save()

  await AuditLog.create({
    userId,
    userEmail,
    action: 'ROTATE_DEVICE_KEY',
    resource: `Device:${deviceId}`,
    timestamp: new Date(),
  }).catch((err) => console.error('[Audit] Failed to log device key rotation:', err))

  return { apiKey, apiKeyPrefix: device.apiKeyPrefix }
}

export async function setDeviceRevocation(
  deviceId: string,
  isRevoked: boolean,
  userId?: string,
  userEmail?: string,
): Promise<IDevice> {
  const device = await Device.findOne({ deviceId })
  if (!device) {
    throw new Error(`Device ${deviceId} not found.`)
  }

  device.isRevoked = isRevoked
  if (isRevoked) {
    device.status = 'OFFLINE'
  }
  await device.save()

  await AuditLog.create({
    userId,
    userEmail,
    action: isRevoked ? 'REVOKE_DEVICE' : 'RESTORE_DEVICE',
    resource: `Device:${deviceId}`,
    timestamp: new Date(),
  }).catch((err) => console.error('[Audit] Failed to log device revocation:', err))

  return device
}

export async function getDeviceInfo(deviceId: string): Promise<IDevice | null> {
  return Device.findOne({ deviceId })
}

export async function listUserDevices(userId?: string, isAdmin?: boolean): Promise<IDevice[]> {
  if (isAdmin) {
    return Device.find().sort({ createdAt: -1 })
  }
  if (!userId) return []
  return Device.find({ ownerId: userId }).sort({ createdAt: -1 })
}
