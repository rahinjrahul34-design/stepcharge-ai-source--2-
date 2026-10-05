import { Device, IDevice, ILoadState } from '../models/Device.js'
import { emitLoadStateChanged } from '../config/socket.js'
import { AuditLog } from '../models/AuditLog.js'

export type LoadKey = 'led' | 'fan'

export async function setLoadCommand(
  deviceId: string,
  load: LoadKey,
  command: boolean,
  userId?: string,
  userEmail?: string,
): Promise<{ loads: IDevice['loads'] }> {
  const device = await Device.findOne({ deviceId })
  if (!device) {
    throw new Error(`Device ${deviceId} not found.`)
  }

  if (device.isRevoked) {
    throw new Error(`Device ${deviceId} has been revoked.`)
  }

  // Set the command state — but DO NOT change actualState!
  device.loads[load].command = command
  device.loads[load].updatedAt = new Date()
  await device.save()

  // Audit log the command
  await AuditLog.create({
    userId,
    userEmail,
    action: 'SET_LOAD_COMMAND',
    resource: `Device:${deviceId}:loads:${load}`,
    metadata: { load, command },
    timestamp: new Date(),
  }).catch((err) => console.error('[Audit] Failed to log load command:', err))

  emitLoadStateChanged(deviceId, device.loads)

  return { loads: device.loads }
}

export async function reportActualLoadState(
  deviceId: string,
  load: LoadKey,
  actualState: boolean,
  reportedAt?: string,
): Promise<{ loads: IDevice['loads'] }> {
  const device = await Device.findOne({ deviceId })
  if (!device) {
    throw new Error(`Device ${deviceId} not found.`)
  }

  device.loads[load].actualState = actualState
  device.loads[load].reportedAt = reportedAt ? new Date(reportedAt) : new Date()
  await device.save()

  emitLoadStateChanged(deviceId, device.loads)

  return { loads: device.loads }
}

export async function getDeviceLoads(deviceId: string): Promise<IDevice['loads']> {
  const device = await Device.findOne({ deviceId })
  if (!device) {
    return {
      led: { command: false, actualState: null, updatedAt: new Date() },
      fan: { command: false, actualState: null, updatedAt: new Date() },
    }
  }
  return device.loads
}
