import mongoose, { Schema, Document } from 'mongoose'

export interface ILoadState {
  command: boolean
  actualState: boolean | null
  updatedAt?: Date
  reportedAt?: Date
}

export interface IDeviceConfig {
  samplingIntervalMs: number
  telemetryIntervalMs: number
  stepThresholdVoltage: number
  stepReleaseVoltage: number
  minPulseDurationMs: number
  maxPulseDurationMs: number
  refractoryPeriodMs: number
  storageWarningVoltage: number
  storageLowVoltage: number
  storageMaxSafeVoltage: number
  voltageCalibrationScale: number
  voltageCalibrationOffset: number
  currentCalibrationScale: number
  currentCalibrationOffset: number
  supercapFarads: number
  version: number
  updatedAt: Date
  updatedBy?: mongoose.Types.ObjectId
}

export interface IAppliedConfigStatus {
  version: number
  status: 'SYNCHRONIZED' | 'PENDING' | 'REJECTED'
  appliedAt?: Date
  rejectionReason?: string
}

export interface IHardwareInfo {
  currentSensorInstalled: boolean
  currentSensorType: string // 'NONE' | 'INA219' | 'INA226'
  voltageDividerRatio: number
  adcReferenceVoltage: number
}

export interface IDevice extends Document {
  deviceId: string
  name: string
  location: string
  ownerId?: mongoose.Types.ObjectId
  firmwareVersion: string
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE'
  lastSeenAt?: Date
  lastIp?: string
  rssi?: number
  uptimeSec?: number
  apiKeyHash?: string
  apiKeyPrefix?: string
  isRevoked: boolean
  loads: {
    led: ILoadState
    fan: ILoadState
  }
  configuration: {
    desired: IDeviceConfig
    applied: IAppliedConfigStatus
  }
  hardware: IHardwareInfo
  createdAt: Date
  updatedAt: Date
}

const LoadStateSchema = new Schema<ILoadState>(
  {
    command: { type: Boolean, default: false },
    actualState: { type: Boolean, default: null },
    updatedAt: { type: Date, default: Date.now },
    reportedAt: { type: Date },
  },
  { _id: false },
)

export const DeviceConfigSchema = new Schema<IDeviceConfig>(
  {
    samplingIntervalMs: { type: Number, default: 20, min: 5, max: 1000 },
    telemetryIntervalMs: { type: Number, default: 1000, min: 200, max: 60000 },
    stepThresholdVoltage: { type: Number, default: 0.8, min: 0.1, max: 20.0 },
    stepReleaseVoltage: { type: Number, default: 0.55, min: 0.05, max: 15.0 },
    minPulseDurationMs: { type: Number, default: 60, min: 10, max: 5000 },
    maxPulseDurationMs: { type: Number, default: 2000, min: 100, max: 30000 },
    refractoryPeriodMs: { type: Number, default: 250, min: 50, max: 5000 },
    storageWarningVoltage: { type: Number, default: 4.7, min: 1.0, max: 6.0 },
    storageLowVoltage: { type: Number, default: 2.0, min: 0.5, max: 5.0 },
    storageMaxSafeVoltage: { type: Number, default: 5.0, min: 2.0, max: 5.5 },
    voltageCalibrationScale: { type: Number, default: 1.0, min: 0.1, max: 10.0 },
    voltageCalibrationOffset: { type: Number, default: 0.0, min: -5.0, max: 5.0 },
    currentCalibrationScale: { type: Number, default: 1.0, min: 0.1, max: 10.0 },
    currentCalibrationOffset: { type: Number, default: 0.0, min: -100.0, max: 100.0 },
    supercapFarads: { type: Number, default: 0.1, min: 0.001, max: 100.0 },
    version: { type: Number, default: 1, min: 1 },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false },
)

export const AppliedConfigStatusSchema = new Schema<IAppliedConfigStatus>(
  {
    version: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['SYNCHRONIZED', 'PENDING', 'REJECTED'],
      default: 'SYNCHRONIZED',
    },
    appliedAt: { type: Date, default: Date.now },
    rejectionReason: { type: String, default: null },
  },
  { _id: false },
)

export const HardwareInfoSchema = new Schema<IHardwareInfo>(
  {
    currentSensorInstalled: { type: Boolean, default: false },
    currentSensorType: { type: String, default: 'NONE' },
    voltageDividerRatio: { type: Number, default: 2.0 },
    adcReferenceVoltage: { type: Number, default: 3.3 },
  },
  { _id: false },
)

const DeviceSchema = new Schema<IDevice>(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      default: 'StepCharge Mat',
      trim: true,
    },
    location: {
      type: String,
      default: 'Lab / Deployment',
      trim: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    firmwareVersion: {
      type: String,
      default: '2.0.0',
    },
    status: {
      type: String,
      enum: ['ONLINE', 'DEGRADED', 'OFFLINE'],
      default: 'OFFLINE',
      index: true,
    },
    lastSeenAt: {
      type: Date,
      index: true,
    },
    lastIp: {
      type: String,
    },
    rssi: {
      type: Number,
    },
    uptimeSec: {
      type: Number,
    },
    apiKeyHash: {
      type: String,
      select: false, // never return in normal queries
    },
    apiKeyPrefix: {
      type: String,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    loads: {
      led: { type: LoadStateSchema, default: () => ({ command: false, actualState: null }) },
      fan: { type: LoadStateSchema, default: () => ({ command: false, actualState: null }) },
    },
    configuration: {
      desired: {
        type: DeviceConfigSchema,
        default: () => ({
          samplingIntervalMs: 20,
          telemetryIntervalMs: 1000,
          stepThresholdVoltage: 0.8,
          stepReleaseVoltage: 0.55,
          minPulseDurationMs: 60,
          maxPulseDurationMs: 2000,
          refractoryPeriodMs: 250,
          storageWarningVoltage: 4.7,
          storageLowVoltage: 2.0,
          storageMaxSafeVoltage: 5.0,
          voltageCalibrationScale: 1.0,
          voltageCalibrationOffset: 0.0,
          currentCalibrationScale: 1.0,
          currentCalibrationOffset: 0.0,
          supercapFarads: 0.1,
          version: 1,
          updatedAt: new Date(),
        }),
      },
      applied: {
        type: AppliedConfigStatusSchema,
        default: () => ({
          version: 1,
          status: 'SYNCHRONIZED',
          appliedAt: new Date(),
        }),
      },
    },
    hardware: {
      type: HardwareInfoSchema,
      default: () => ({
        currentSensorInstalled: false,
        currentSensorType: 'NONE',
        voltageDividerRatio: 2.0,
        adcReferenceVoltage: 3.3,
      }),
    },
  },
  {
    timestamps: true,
  },
)

export const Device = mongoose.model<IDevice>('Device', DeviceSchema)
