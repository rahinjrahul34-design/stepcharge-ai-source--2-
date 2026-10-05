import mongoose, { Schema, Document } from 'mongoose'

export interface IStepFeatures {
  peakVoltage: number
  averageVoltage: number
  pulseDuration: number
  stepInterval: number
  storageVoltage: number
}

export interface IFootstep extends Document {
  deviceId: string
  timestamp: Date
  sequenceNumber: number | null
  features: IStepFeatures
  waveform: number[]
  samplingRate: number
  current: number | null
  power: number | null
  measuredEnergyJ: number | null
  stepClass: 'LIGHT' | 'NORMAL' | 'HEAVY' | 'UNKNOWN'
  confidence: number | null
  probabilities?: {
    LIGHT: number
    NORMAL: number
    HEAVY: number
  }
  predictionSource: 'ML PREDICTION' | 'DEVICE PREDICTION' | 'UNCLASSIFIED' | 'DEMO PREDICTION'
  estimatedEnergyJ: number
  measurementQuality: 'VALID' | 'CALIBRATING' | 'OUT_OF_RANGE' | 'ESTIMATED' | 'UNAVAILABLE'
  energyProvenance: {
    method: 'MEASURED_POWER_INTEGRAL' | 'CAPACITOR_ESTIMATE' | 'STEP_ESTIMATE' | 'UNAVAILABLE'
    quality: string
  }
  dataMode?: 'LIVE' | 'DEMO'
  source?: 'ESP32' | 'DEMO' | 'SIMULATOR'
  participantId?: string
  experimentId?: string
  calibrationVersion?: string
  processingVersion?: string
  validationStatus?: 'VALID' | 'INVALID' | 'REVIEW_REQUIRED'
  rejectionReason?: string
  featureVersion: string
  modelVersion: string | null
  createdAt: Date
}

const FootstepFeaturesSchema = new Schema<IStepFeatures>(
  {
    peakVoltage: { type: Number, required: true, min: 0, max: 60 },
    averageVoltage: { type: Number, required: true, min: 0, max: 60 },
    pulseDuration: { type: Number, required: true, min: 0, max: 60000 },
    stepInterval: { type: Number, required: true, min: 0, max: 3600 },
    storageVoltage: { type: Number, required: true, min: 0, max: 60 },
  },
  { _id: false },
)

const FootstepSchema = new Schema<IFootstep>(
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
    features: {
      type: FootstepFeaturesSchema,
      required: true,
    },
    waveform: {
      type: [Number],
      default: [],
    },
    samplingRate: {
      type: Number,
      default: 50,
    },
    current: {
      type: Number,
      default: null,
    },
    power: {
      type: Number,
      default: null,
    },
    measuredEnergyJ: {
      type: Number,
      default: null,
    },
    stepClass: {
      type: String,
      enum: ['LIGHT', 'NORMAL', 'HEAVY', 'UNKNOWN'],
      default: 'UNKNOWN',
      index: true,
    },
    confidence: {
      type: Number,
      default: null,
    },
    probabilities: {
      LIGHT: { type: Number, default: 0 },
      NORMAL: { type: Number, default: 0 },
      HEAVY: { type: Number, default: 0 },
    },
    predictionSource: {
      type: String,
      enum: ['ML PREDICTION', 'DEVICE PREDICTION', 'UNCLASSIFIED', 'DEMO PREDICTION'],
      default: 'UNCLASSIFIED',
    },
    estimatedEnergyJ: {
      type: Number,
      required: true,
      min: 0,
    },
    measurementQuality: {
      type: String,
      enum: ['VALID', 'CALIBRATING', 'OUT_OF_RANGE', 'ESTIMATED', 'UNAVAILABLE'],
      default: 'VALID',
    },
    energyProvenance: {
      method: {
        type: String,
        enum: ['MEASURED_POWER_INTEGRAL', 'CAPACITOR_ESTIMATE', 'STEP_ESTIMATE', 'UNAVAILABLE'],
        default: 'CAPACITOR_ESTIMATE',
      },
      quality: { type: String, default: 'VALID' },
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
    participantId: {
      type: String,
      trim: true,
      index: true,
    },
    experimentId: {
      type: String,
      trim: true,
      index: true,
    },
    calibrationVersion: {
      type: String,
      default: 'cal-v1.0',
    },
    processingVersion: {
      type: String,
      default: 'pulse-v2.0',
    },
    validationStatus: {
      type: String,
      enum: ['VALID', 'INVALID', 'REVIEW_REQUIRED'],
      default: 'VALID',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    featureVersion: {
      type: String,
      default: 'features-v1',
    },
    modelVersion: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
)

FootstepSchema.index({ deviceId: 1, timestamp: -1 })
FootstepSchema.index({ deviceId: 1, stepClass: 1, timestamp: -1 })
FootstepSchema.index({ deviceId: 1, sequenceNumber: -1 }, { sparse: true })

export const Footstep = mongoose.model<IFootstep>('Footstep', FootstepSchema)
