import { Telemetry, ITelemetry, IEnergyProvenance } from '../models/Telemetry.js'
import { Device } from '../models/Device.js'
import { Alert } from '../models/Alert.js'
import { emitTelemetryUpdate, emitDeviceStatus, emitAlertCreated } from '../config/socket.js'
import { config } from '../config/env.js'
import { detectAndRecordAnomaly } from './aiAnomalyService.js'

export interface RawTelemetryInput {
  deviceId: string
  timestamp?: string
  sequenceNumber?: number | null
  configurationVersion?: number | null
  uptimeSec?: number
  storageVoltage: number
  peakVoltage: number
  averageVoltage: number
  pulseDuration: number
  stepInterval: number
  footstepCount: number
  current?: number | null
  power?: number | null
  energy?: number | null
  measurementQuality?: 'VALID' | 'CALIBRATING' | 'SENSOR_DISCONNECTED' | 'OUT_OF_RANGE' | 'STALE' | 'ESTIMATED' | 'UNAVAILABLE'
  currentQuality?: 'MEASURED' | 'NOT_INSTALLED' | 'SENSOR_DISCONNECTED' | 'OUT_OF_RANGE' | 'UNAVAILABLE'
  powerQuality?: 'MEASURED' | 'NOT_AVAILABLE' | 'CALCULATED'
  wifiRssi?: number
  deviceStatus?: 'ONLINE' | 'DEGRADED' | 'OFFLINE'
  firmwareVersion?: string
  loadControlAvailable?: boolean
  stepClass?: 'LIGHT' | 'NORMAL' | 'HEAVY' | 'UNKNOWN'
  confidence?: number | null
}

export function validateTelemetryPayload(data: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!data || typeof data !== 'object') {
    return { ok: false, errors: ['Payload must be an object'] }
  }

  const p = data as Record<string, unknown>
  if (typeof p.deviceId !== 'string' || !p.deviceId.trim()) errors.push('deviceId is required')

  const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  const inRange = (v: unknown, min: number, max: number): boolean => isNum(v) && v >= min && v <= max

  if (!inRange(p.peakVoltage, 0, 60)) errors.push('peakVoltage must be between 0 and 60 V')
  if (!inRange(p.averageVoltage, 0, 60)) errors.push('averageVoltage must be between 0 and 60 V')
  if (!inRange(p.storageVoltage, 0, 60)) errors.push('storageVoltage must be between 0 and 60 V')
  if (!inRange(p.footstepCount, 0, 1e9)) errors.push('footstepCount must be a non-negative number')
  if (!inRange(p.pulseDuration, 0, 60000)) errors.push('pulseDuration must be between 0 and 60000 ms')

  if (p.stepInterval !== undefined && !inRange(p.stepInterval, 0, 3600)) {
    errors.push('stepInterval must be between 0 and 3600 s')
  }

  if (p.current !== undefined && p.current !== null && !inRange(p.current, 0, 50)) {
    errors.push('current must be between 0 and 50 A')
  }

  if (p.power !== undefined && p.power !== null && !inRange(p.power, 0, 3000)) {
    errors.push('power must be between 0 and 3000 W')
  }

  if (p.wifiRssi !== undefined && !inRange(p.wifiRssi, -120, 0)) {
    errors.push('wifiRssi must be between -120 and 0 dBm')
  }

  if (p.uptimeSec !== undefined && !inRange(p.uptimeSec, 0, 3.2e9)) {
    errors.push('uptimeSec must be a valid non-negative integer')
  }

  if (isNum(p.averageVoltage) && isNum(p.peakVoltage) && p.averageVoltage > p.peakVoltage * 1.05) {
    errors.push('averageVoltage cannot exceed peakVoltage')
  }

  return { ok: errors.length === 0, errors }
}

export function calculateStoredEnergy(voltage: number, capacitanceFarads = config.supercapFarads): number {
  if (voltage <= 0 || capacitanceFarads <= 0) return 0
  return 0.5 * capacitanceFarads * (voltage * voltage)
}

export async function processTelemetry(
  raw: RawTelemetryInput,
  clientIp?: string,
): Promise<ITelemetry> {
  // Deduplication check if sequenceNumber is provided
  if (raw.sequenceNumber != null) {
    const existing = await Telemetry.findOne({
      deviceId: raw.deviceId,
      sequenceNumber: raw.sequenceNumber,
    })
    if (existing) {
      return existing
    }
  }

  const timestamp = raw.timestamp ? new Date(raw.timestamp) : new Date()
  const estimatedStoredEnergy = calculateStoredEnergy(raw.storageVoltage, config.supercapFarads)

  // Determine real electrical power & energy provenance honestly
  let calculatedPower = raw.power ?? null
  let currentQuality = raw.currentQuality ?? (raw.current != null ? 'MEASURED' : 'NOT_INSTALLED')
  let powerQuality = raw.powerQuality ?? (raw.power != null ? 'MEASURED' : 'NOT_AVAILABLE')
  
  if (raw.current != null && raw.current >= 0 && raw.storageVoltage >= 0) {
    if (calculatedPower == null) {
      calculatedPower = raw.storageVoltage * raw.current // P = V * I (Watts)
      powerQuality = 'CALCULATED'
    }
  }

  const energyProvenance: IEnergyProvenance = raw.energy != null && raw.energy > 0
    ? { method: 'MEASURED_POWER_INTEGRAL', quality: 'VALID', unit: 'J' }
    : { method: 'CAPACITOR_ESTIMATE', quality: 'VALID', unit: 'J' }

  // 1. Save Telemetry Document
  const doc = await Telemetry.create({
    deviceId: raw.deviceId,
    timestamp,
    sequenceNumber: raw.sequenceNumber ?? null,
    configurationVersion: raw.configurationVersion ?? 1,
    uptimeSec: raw.uptimeSec,
    storageVoltage: raw.storageVoltage,
    peakVoltage: raw.peakVoltage,
    averageVoltage: raw.averageVoltage,
    pulseDuration: raw.pulseDuration,
    stepInterval: raw.stepInterval ?? 0,
    footstepCount: raw.footstepCount,
    current: raw.current ?? null,
    power: calculatedPower,
    energy: raw.energy ?? null,
    estimatedStoredEnergy,
    measurementQuality: raw.measurementQuality ?? 'VALID',
    currentQuality,
    powerQuality,
    energyProvenance,
    wifiRssi: raw.wifiRssi,
    deviceStatus: raw.deviceStatus ?? 'ONLINE',
    firmwareVersion: raw.firmwareVersion,
    loadControlAvailable: raw.loadControlAvailable ?? true,
    stepClass: raw.stepClass ?? 'UNKNOWN',
    confidence: raw.confidence ?? null,
  })

  // 2. Update existing Device state (upsert is false to avoid unprovisioned devices)
  const updatedDevice = await Device.findOneAndUpdate(
    { deviceId: raw.deviceId },
    {
      $set: {
        status: raw.deviceStatus ?? 'ONLINE',
        lastSeenAt: timestamp,
        lastIp: clientIp,
        rssi: raw.wifiRssi,
        uptimeSec: raw.uptimeSec,
        ...(raw.firmwareVersion ? { firmwareVersion: raw.firmwareVersion } : {}),
      },
    },
    { new: true, upsert: false },
  )

  // Asynchronous anomaly detection evaluation
  detectAndRecordAnomaly(
    {
      peakVoltage: raw.peakVoltage,
      averageVoltage: raw.averageVoltage,
      pulseDuration: raw.pulseDuration,
      stepInterval: raw.stepInterval,
      storageVoltage: raw.storageVoltage,
      current: raw.current,
      power: calculatedPower,
    },
    raw.deviceId,
  ).catch((err) => console.error('[Anomaly] Anomaly evaluation failed:', err))

  // 3. Automated System Alerts based on safety boundaries
  if (raw.storageVoltage < config.lowStorageVoltage) {
    const existing = await Alert.findOne({
      deviceId: raw.deviceId,
      type: 'LOW_STORAGE_VOLTAGE',
      resolved: false,
    })
    if (!existing) {
      const alert = await Alert.create({
        deviceId: raw.deviceId,
        category: 'ENERGY',
        type: 'LOW_STORAGE_VOLTAGE',
        title: 'Low Storage Voltage Warning',
        reason: `Supercapacitor voltage dropped below ${config.lowStorageVoltage.toFixed(1)} V threshold.`,
        severity: 'warning',
        currentValue: `${raw.storageVoltage.toFixed(2)} V`,
        threshold: `${config.lowStorageVoltage.toFixed(2)} V`,
        action: 'Inspect load draw and allow footstep energy to accumulate.',
      })
      emitAlertCreated(alert)
    }
  } else if (raw.storageVoltage > config.maxStorageVoltage) {
    const existing = await Alert.findOne({
      deviceId: raw.deviceId,
      type: 'STORAGE_OVERVOLTAGE',
      resolved: false,
    })
    if (!existing) {
      const alert = await Alert.create({
        deviceId: raw.deviceId,
        category: 'ENERGY',
        type: 'STORAGE_OVERVOLTAGE',
        title: 'Supercapacitor Overvoltage Warning',
        reason: `Supercapacitor voltage exceeded maximum safety ceiling of ${config.maxStorageVoltage.toFixed(1)} V.`,
        severity: 'critical',
        currentValue: `${raw.storageVoltage.toFixed(2)} V`,
        threshold: `${config.maxStorageVoltage.toFixed(2)} V`,
        action: 'Verify voltage clamp circuit to prevent capacitor dielectric breakdown.',
      })
      emitAlertCreated(alert)
    }
  }

  // 4. Real-time Socket.IO emission strictly to room device:<deviceId>
  const wirePacket = {
    timestamp: doc.timestamp.toISOString(),
    device_id: doc.deviceId,
    sequence_number: doc.sequenceNumber,
    configuration_version: doc.configurationVersion,
    footstep_count: doc.footstepCount,
    peak_voltage: doc.peakVoltage,
    average_voltage: doc.averageVoltage,
    storage_voltage: doc.storageVoltage,
    pulse_duration_ms: doc.pulseDuration,
    step_interval_ms: Math.round((doc.stepInterval ?? 0) * 1000),
    current_a: doc.current,
    power_w: doc.power,
    measured_energy_j: doc.energy,
    estimated_energy_j: doc.estimatedStoredEnergy,
    measurement_quality: doc.measurementQuality,
    current_quality: doc.currentQuality,
    power_quality: doc.powerQuality,
    energy_provenance: doc.energyProvenance,
    step_class: doc.stepClass,
    confidence: doc.confidence,
    prediction_source: doc.stepClass && doc.stepClass !== 'UNKNOWN' ? 'DEVICE PREDICTION' : 'UNCLASSIFIED',
    loads: updatedDevice ? updatedDevice.loads : { led: { command: false, actualState: null }, fan: { command: false, actualState: null } },
    load_control_available: doc.loadControlAvailable,
    wifi_rssi: doc.wifiRssi ?? -100,
    uptime_sec: doc.uptimeSec ?? null,
    device_status: doc.deviceStatus === 'ONLINE' ? 'online' : doc.deviceStatus === 'DEGRADED' ? 'degraded' : 'offline',
    firmware_version: doc.firmwareVersion ?? 'unknown',
    source: 'live',
  }

  emitTelemetryUpdate(raw.deviceId, wirePacket)
  if (updatedDevice) {
    emitDeviceStatus(raw.deviceId, {
      deviceId: raw.deviceId,
      status: updatedDevice.status,
      lastSeen: updatedDevice.lastSeenAt,
      rssi: updatedDevice.rssi,
      uptimeSec: updatedDevice.uptimeSec,
    })
  }

  return doc
}

export async function getLatestTelemetry(deviceId: string): Promise<ITelemetry | null> {
  return Telemetry.findOne({ deviceId }).sort({ timestamp: -1 })
}
