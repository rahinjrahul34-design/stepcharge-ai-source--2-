import mongoose, { Schema, Document } from 'mongoose'

export interface IEnergyProvenance {
  method: 'MEASURED_POWER_INTEGRAL' | 'CAPACITOR_ESTIMATE' | 'STEP_ESTIMATE' | 'UNAVAILABLE'
  quality: string
  unit: string
}

export interface ITelemetry extends Document {
  deviceId: string
  timestamp: Date
  sequenceNumber: number | null
  configurationVersion: number | null
  uptimeSec?: number
  storageVoltage: number
  peakVoltage: number
  averageVoltage: number
  pulseDuration: number
  stepInterval: number
  footstepCount: number
  current: number | null
  power: number | null
  energy: number | null
  estimatedStoredEnergy?: number
  measurementQuality: 'VALID' | 'CALIBRATING' | 'SENSOR_DISCONNECTED' | 'OUT_OF_RANGE' | 'STALE' | 'ESTIMATED' | 'UNAVAILABLE'
  currentQuality: 'MEASURED' | 'NOT_INSTALLED' | 'SENSOR_DISCONNECTED' | 'OUT_OF_RANGE' | 'UNAVAILABLE'
  powerQuality: 'MEASURED' | 'NOT_AVAILABLE' | 'CALCULATED'
  energyProvenance: IEnergyProvenance
  wifiRssi?: number
  deviceStatus: 'ONLINE' | 'DEGRADED' | 'OFFLINE'
  firmwareVersion?: string
  loadControlAvailable: boolean
  stepClass?: 'LIGHT' | 'NORMAL' | 'HEAVY' | 'UNKNOWN'
  confidence?: number | null
  dataMode?: 'LIVE' | 'DEMO'
  source?: 'ESP32' | 'DEMO' | 'SIMULATOR'
  sensorVersion?: string
  calibrationVersion?: string
  processingVersion?: string
  createdAt: Date
}

const EnergyProvenanceSchema = new Schema<IEnergyProvenance>(
  {
    method: {
      type: String,
      enum: ['MEASURED_POWER_INTEGRAL', 'CAPACITOR_ESTIMATE', 'STEP_ESTIMATE', 'UNAVAILABLE'],
      default: 'CAPACITOR_ESTIMATE',
    },
    quality: { type: String, default: 'VALID' },
    unit: { type: String, default: 'J' },
  },
  { _id: false },
)

const TelemetrySchema = new Schema<ITelemetry>(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    sequenceNumber: {
      type: Number,
      default: null,
      index: true,
    },
    configurationVersion: {
      type: Number,
      default: 1,
    },
    uptimeSec: {
      type: Number,
    },
    storageVoltage: {
      type: Number,
      required: true,
      min: 0,
      max: 60,
    },
    peakVoltage: {
      type: Number,
      required: true,
      min: 0,
      max: 60,
    },
    averageVoltage: {
      type: Number,
      required: true,
      min: 0,
      max: 60,
    },
    pulseDuration: {
      type: Number,
      required: true,
      min: 0,
      max: 60000,
    },
    stepInterval: {
      type: Number,
      required: true,
      min: 0,
      max: 3600,
    },
    footstepCount: {
      type: Number,
      required: true,
      min: 0,
    },
    current: {
      type: Number,
      default: null,
    },
    power: {
      type: Number,
      default: null,
    },
    energy: {
      type: Number,
      default: null,
    },
    estimatedStoredEnergy: {
      type: Number,
      default: null,
    },
    measurementQuality: {
      type: String,
      enum: ['VALID', 'CALIBRATING', 'SENSOR_DISCONNECTED', 'OUT_OF_RANGE', 'STALE', 'ESTIMATED', 'UNAVAILABLE'],
      default: 'VALID',
    },
    currentQuality: {
      type: String,
      enum: ['MEASURED', 'NOT_INSTALLED', 'SENSOR_DISCONNECTED', 'OUT_OF_RANGE', 'UNAVAILABLE'],
      default: 'NOT_INSTALLED',
    },
    powerQuality: {
      type: String,
      enum: ['MEASURED', 'NOT_AVAILABLE', 'CALCULATED'],
      default: 'NOT_AVAILABLE',
    },
    energyProvenance: {
      type: EnergyProvenanceSchema,
      default: () => ({
        method: 'CAPACITOR_ESTIMATE',
        quality: 'VALID',
        unit: 'J',
      }),
    },
    wifiRssi: {
      type: Number,
      min: -120,
      max: 0,
    },
    deviceStatus: {
      type: String,
      enum: ['ONLINE', 'DEGRADED', 'OFFLINE'],
      default: 'ONLINE',
    },
    firmwareVersion: {
      type: String,
    },
    loadControlAvailable: {
      type: Boolean,
      default: true,
    },
    stepClass: {
      type: String,
      enum: ['LIGHT', 'NORMAL', 'HEAVY', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    confidence: {
      type: Number,
      default: null,
    },
    dataMode: {
      type: String,
      enum: ['LIVE', 'DEMO'],
      default: 'LIVE',
      index: true,
    },
    source: {
      type: String,
      default: 'ESP32',
    },
    sensorVersion: {
      type: String,
      default: 'piezo-v2.0',
    },
    calibrationVersion: {
      type: String,
      default: 'cal-v1.0',
    },
    processingVersion: {
      type: String,
      default: 'telemetry-v2',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
)

// Optimized compound indexes for low-latency queries and duplicate protection
TelemetrySchema.index({ deviceId: 1, timestamp: -1 })
TelemetrySchema.index({ deviceId: 1, sequenceNumber: -1 }, { sparse: true })

export const Telemetry = mongoose.model<ITelemetry>('Telemetry', TelemetrySchema)
