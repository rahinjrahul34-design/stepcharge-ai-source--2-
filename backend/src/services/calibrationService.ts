import { Device } from '../models/Device.js'
import { CalibrationLog, CalibrationType } from '../models/CalibrationLog.js'
import { updateDeviceConfiguration } from './deviceConfigService.js'
import mongoose from 'mongoose'

export interface VoltageCalibrationInput {
  referenceVoltage: number // Measured via trusted multimeter, e.g. 4.20V
  measuredVoltage: number  // Uncalibrated ADC reading from ESP32
  apply?: boolean
}

export interface CurrentCalibrationInput {
  referenceCurrentMa: number // Known reference current, e.g. 20.0 mA
  measuredCurrentMa: number  // Sensor reading from ESP32
  apply?: boolean
}

export interface PiezoCalibrationInput {
  baselineNoiseV: number
  lightStepPeakV: number
  normalStepPeakV: number
  heavyStepPeakV: number
  apply?: boolean
}

function toObjectId(id: string): mongoose.Types.ObjectId {
  return mongoose.Types.ObjectId.isValid(id)
    ? new mongoose.Types.ObjectId(id)
    : new mongoose.Types.ObjectId('507f1f77bcf86cd799439011')
}

export async function calibrateVoltage(
  deviceId: string,
  input: VoltageCalibrationInput,
  userId: string,
  userEmail: string,
) {
  const { referenceVoltage, measuredVoltage, apply = false } = input

  if (referenceVoltage <= 0 || measuredVoltage <= 0) {
    throw new Error('Reference and measured voltages must be positive finite numbers.')
  }

  const device = await Device.findOne({ deviceId })
  if (!device) throw new Error(`Device '${deviceId}' not found.`)

  const previousScale = device.configuration?.desired?.voltageCalibrationScale ?? 1.0
  const previousOffset = device.configuration?.desired?.voltageCalibrationOffset ?? 0.0

  // Calculate new scale correction factor
  // raw = measured / previousScale
  // newScale = reference / raw
  const newScale = Number(((referenceVoltage / measuredVoltage) * previousScale).toFixed(4))
  const errorPercent = Number((Math.abs(measuredVoltage - referenceVoltage) / referenceVoltage * 100).toFixed(2))

  const log = await CalibrationLog.create({
    deviceId,
    calibrationType: 'VOLTAGE',
    performedBy: toObjectId(userId),
    userEmail,
    referenceValue: referenceVoltage,
    measuredValue: measuredVoltage,
    previousScale,
    newScale,
    previousOffset,
    newOffset: 0.0,
    errorPercent,
    result: errorPercent <= 2.0 ? 'PASS' : 'APPLIED',
    notes: `Voltage calibrated against multimeter reference (${referenceVoltage}V vs measured ${measuredVoltage}V)`,
  })

  if (apply) {
    await updateDeviceConfiguration(deviceId, { voltageCalibrationScale: newScale }, userId, userEmail)
  }

  return {
    logId: log._id,
    referenceVoltage,
    measuredVoltage,
    previousScale,
    newScale,
    errorPercent,
    applied: apply,
    status: errorPercent <= 2.0 ? 'PASS' : 'WARNING_HIGH_DEVIATION',
  }
}

export async function calibrateCurrent(
  deviceId: string,
  input: CurrentCalibrationInput,
  userId: string,
  userEmail: string,
) {
  const device = await Device.findOne({ deviceId })
  if (!device) throw new Error(`Device '${deviceId}' not found.`)

  // Check if current sensor is physically installed
  if (!device.hardware?.currentSensorInstalled) {
    throw new Error('CURRENT_SENSOR_NOT_INSTALLED: Current calibration cannot be performed because no current sensor is installed on this device.')
  }

  const { referenceCurrentMa, measuredCurrentMa, apply = false } = input
  if (referenceCurrentMa <= 0 || measuredCurrentMa <= 0) {
    throw new Error('Reference and measured current must be positive numbers.')
  }

  const previousScale = device.configuration?.desired?.currentCalibrationScale ?? 1.0
  const previousOffset = device.configuration?.desired?.currentCalibrationOffset ?? 0.0

  const newScale = Number(((referenceCurrentMa / measuredCurrentMa) * previousScale).toFixed(4))
  const errorPercent = Number((Math.abs(measuredCurrentMa - referenceCurrentMa) / referenceCurrentMa * 100).toFixed(2))

  const log = await CalibrationLog.create({
    deviceId,
    calibrationType: 'CURRENT',
    performedBy: toObjectId(userId),
    userEmail,
    referenceValue: referenceCurrentMa,
    measuredValue: measuredCurrentMa,
    previousScale,
    newScale,
    previousOffset,
    newOffset: 0.0,
    errorPercent,
    result: errorPercent <= 3.0 ? 'PASS' : 'APPLIED',
    notes: `Current calibrated against reference source (${referenceCurrentMa}mA vs ${measuredCurrentMa}mA)`,
  })

  if (apply) {
    await updateDeviceConfiguration(deviceId, { currentCalibrationScale: newScale }, userId, userEmail)
  }

  return {
    logId: log._id,
    referenceCurrentMa,
    measuredCurrentMa,
    previousScale,
    newScale,
    errorPercent,
    applied: apply,
    status: errorPercent <= 3.0 ? 'PASS' : 'WARNING_HIGH_DEVIATION',
  }
}

export async function calibratePiezoThresholds(
  deviceId: string,
  input: PiezoCalibrationInput,
  userId: string,
  userEmail: string,
) {
  const { baselineNoiseV, lightStepPeakV, apply = false } = input

  if (baselineNoiseV < 0 || lightStepPeakV <= baselineNoiseV) {
    throw new Error('Light step peak voltage must exceed baseline noise floor.')
  }

  // Recommended trigger threshold: midway between noise floor and light step peak
  const recommendedThreshold = Number((baselineNoiseV + (lightStepPeakV - baselineNoiseV) * 0.4).toFixed(2))
  const recommendedRelease = Number((baselineNoiseV + (lightStepPeakV - baselineNoiseV) * 0.15).toFixed(2))

  const log = await CalibrationLog.create({
    deviceId,
    calibrationType: 'PIEZO_THRESHOLD',
    performedBy: toObjectId(userId),
    userEmail,
    referenceValue: lightStepPeakV,
    measuredValue: baselineNoiseV,
    previousScale: 1.0,
    newScale: 1.0,
    previousOffset: 0.0,
    newOffset: 0.0,
    errorPercent: 0,
    result: 'PASS',
    notes: `Thresholds calculated: Trigger ${recommendedThreshold}V, Release ${recommendedRelease}V (Baseline ${baselineNoiseV}V)`,
  })

  if (apply) {
    await updateDeviceConfiguration(
      deviceId,
      {
        stepThresholdVoltage: recommendedThreshold,
        stepReleaseVoltage: recommendedRelease,
      },
      userId,
      userEmail,
    )
  }

  return {
    logId: log._id,
    baselineNoiseV,
    lightStepPeakV,
    recommendedThreshold,
    recommendedRelease,
    applied: apply,
  }
}

export async function getCalibrationLogs(deviceId: string) {
  return CalibrationLog.find({ deviceId }).sort({ timestamp: -1 }).limit(50)
}
