import { Device, IDeviceConfig, IAppliedConfigStatus } from '../models/Device.js'
import { AuditLog } from '../models/AuditLog.js'
import mongoose from 'mongoose'

export interface ConfigUpdateInput {
  samplingIntervalMs?: number
  telemetryIntervalMs?: number
  stepThresholdVoltage?: number
  stepReleaseVoltage?: number
  minPulseDurationMs?: number
  maxPulseDurationMs?: number
  refractoryPeriodMs?: number
  storageWarningVoltage?: number
  storageLowVoltage?: number
  storageMaxSafeVoltage?: number
  voltageCalibrationScale?: number
  voltageCalibrationOffset?: number
  currentCalibrationScale?: number
  currentCalibrationOffset?: number
  supercapFarads?: number
}

export function validateDeviceConfig(input: ConfigUpdateInput): { ok: boolean; errors: string[] } {
  const errors: string[] = []

  if (input.samplingIntervalMs !== undefined && (input.samplingIntervalMs < 5 || input.samplingIntervalMs > 1000)) {
    errors.push('samplingIntervalMs must be between 5 and 1000 ms')
  }

  if (input.telemetryIntervalMs !== undefined && (input.telemetryIntervalMs < 200 || input.telemetryIntervalMs > 60000)) {
    errors.push('telemetryIntervalMs must be between 200 and 60000 ms')
  }

  if (input.stepThresholdVoltage !== undefined && (input.stepThresholdVoltage < 0.1 || input.stepThresholdVoltage > 20.0)) {
    errors.push('stepThresholdVoltage must be between 0.1 and 20.0 V')
  }

  if (input.stepReleaseVoltage !== undefined && (input.stepReleaseVoltage < 0.05 || input.stepReleaseVoltage > 15.0)) {
    errors.push('stepReleaseVoltage must be between 0.05 and 15.0 V')
  }

  if (
    input.stepThresholdVoltage !== undefined &&
    input.stepReleaseVoltage !== undefined &&
    input.stepReleaseVoltage >= input.stepThresholdVoltage
  ) {
    errors.push('stepReleaseVoltage must be strictly less than stepThresholdVoltage')
  }

  if (input.minPulseDurationMs !== undefined && (input.minPulseDurationMs < 10 || input.minPulseDurationMs > 5000)) {
    errors.push('minPulseDurationMs must be between 10 and 5000 ms')
  }

  if (input.maxPulseDurationMs !== undefined && (input.maxPulseDurationMs < 100 || input.maxPulseDurationMs > 30000)) {
    errors.push('maxPulseDurationMs must be between 100 and 30000 ms')
  }

  if (
    input.minPulseDurationMs !== undefined &&
    input.maxPulseDurationMs !== undefined &&
    input.minPulseDurationMs >= input.maxPulseDurationMs
  ) {
    errors.push('minPulseDurationMs must be strictly less than maxPulseDurationMs')
  }

  if (input.storageMaxSafeVoltage !== undefined && (input.storageMaxSafeVoltage < 2.0 || input.storageMaxSafeVoltage > 5.5)) {
    errors.push('storageMaxSafeVoltage must not exceed hardware limit of 5.5 V (and >= 2.0 V)')
  }

  if (input.supercapFarads !== undefined && (input.supercapFarads < 0.001 || input.supercapFarads > 100.0)) {
    errors.push('supercapFarads must be between 0.001 and 100.0 F')
  }

  return { ok: errors.length === 0, errors }
}

export async function getDeviceConfiguration(deviceId: string) {
  const device = await Device.findOne({ deviceId })
  if (!device) return null

  return {
    deviceId: device.deviceId,
    desired: device.configuration?.desired,
    applied: device.configuration?.applied,
    syncStatus: device.configuration?.applied?.status ?? 'SYNCHRONIZED',
    isSynchronized:
      device.configuration?.applied?.version === device.configuration?.desired?.version &&
      device.configuration?.applied?.status === 'SYNCHRONIZED',
  }
}

export async function updateDeviceConfiguration(
  deviceId: string,
  updates: ConfigUpdateInput,
  userId?: string,
  userEmail?: string,
) {
  const validation = validateDeviceConfig(updates)
  if (!validation.ok) {
    throw new Error(`Invalid configuration: ${validation.errors.join('; ')}`)
  }

  const device = await Device.findOne({ deviceId })
  if (!device) {
    throw new Error(`Device '${deviceId}' not found.`)
  }

  const currentDesired = device.configuration?.desired || ({} as IDeviceConfig)
  const nextVersion = (currentDesired.version || 1) + 1

  const mergedConfig: IDeviceConfig = {
    samplingIntervalMs: updates.samplingIntervalMs ?? currentDesired.samplingIntervalMs ?? 20,
    telemetryIntervalMs: updates.telemetryIntervalMs ?? currentDesired.telemetryIntervalMs ?? 1000,
    stepThresholdVoltage: updates.stepThresholdVoltage ?? currentDesired.stepThresholdVoltage ?? 0.8,
    stepReleaseVoltage: updates.stepReleaseVoltage ?? currentDesired.stepReleaseVoltage ?? 0.55,
    minPulseDurationMs: updates.minPulseDurationMs ?? currentDesired.minPulseDurationMs ?? 60,
    maxPulseDurationMs: updates.maxPulseDurationMs ?? currentDesired.maxPulseDurationMs ?? 2000,
    refractoryPeriodMs: updates.refractoryPeriodMs ?? currentDesired.refractoryPeriodMs ?? 250,
    storageWarningVoltage: updates.storageWarningVoltage ?? currentDesired.storageWarningVoltage ?? 4.7,
    storageLowVoltage: updates.storageLowVoltage ?? currentDesired.storageLowVoltage ?? 2.0,
    storageMaxSafeVoltage: updates.storageMaxSafeVoltage ?? currentDesired.storageMaxSafeVoltage ?? 5.0,
    voltageCalibrationScale: updates.voltageCalibrationScale ?? currentDesired.voltageCalibrationScale ?? 1.0,
    voltageCalibrationOffset: updates.voltageCalibrationOffset ?? currentDesired.voltageCalibrationOffset ?? 0.0,
    currentCalibrationScale: updates.currentCalibrationScale ?? currentDesired.currentCalibrationScale ?? 1.0,
    currentCalibrationOffset: updates.currentCalibrationOffset ?? currentDesired.currentCalibrationOffset ?? 0.0,
    supercapFarads: updates.supercapFarads ?? currentDesired.supercapFarads ?? 0.1,
    version: nextVersion,
    updatedAt: new Date(),
    updatedBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
  }

  device.configuration = {
    desired: mergedConfig,
    applied: {
      version: device.configuration?.applied?.version || 1,
      status: 'PENDING',
      rejectionReason: undefined,
    },
  }

  await device.save()

  // Log configuration audit trail
  await AuditLog.create({
    userId,
    userEmail: userEmail || 'system',
    action: 'DEVICE_CONFIG_UPDATED',
    resource: `Device:${deviceId}:v${nextVersion}`,
    details: { nextVersion, updates },
    timestamp: new Date(),
  }).catch((err) => console.error('[Audit] Failed to log config change:', err))

  return {
    desired: mergedConfig,
    applied: device.configuration.applied,
    syncStatus: 'PENDING',
  }
}

export async function reportDeviceConfigStatus(
  deviceId: string,
  appliedVersion: number,
  status: 'SYNCHRONIZED' | 'REJECTED',
  rejectionReason?: string,
) {
  const device = await Device.findOne({ deviceId })
  if (!device) {
    throw new Error(`Device '${deviceId}' not found.`)
  }

  device.configuration.applied = {
    version: appliedVersion,
    status,
    appliedAt: new Date(),
    rejectionReason: status === 'REJECTED' ? rejectionReason : undefined,
  }

  await device.save()
  return device.configuration.applied
}
