import mongoose, { Schema, Document } from 'mongoose'
import type { IStepFeatures } from './Footstep.js'

export interface IDatasetSample extends Document {
  sampleId: string
  deviceId: string
  participantId?: string
  sessionId?: string
  sequenceNumber?: number
  timestamp: Date
  features: IStepFeatures
  waveform?: number[]
  measuredEnergyJ?: number | null
  measurementQuality?: string
  featureVersion: string
  modelVersion?: string
  label: 'LIGHT' | 'NORMAL' | 'HEAVY'
  rejected: boolean
  rejectionReason?: string
  source: 'live' | 'demo'
  note?: string
  createdBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const DatasetSampleSchema = new Schema<IDatasetSample>(
  {
    sampleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    participantId: {
      type: String,
      trim: true,
      index: true,
    },
    sessionId: {
      type: String,
      trim: true,
      index: true,
    },
    sequenceNumber: {
      type: Number,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    features: {
      peakVoltage: { type: Number, required: true, min: 0, max: 60 },
      averageVoltage: { type: Number, required: true, min: 0, max: 60 },
      pulseDuration: { type: Number, required: true, min: 0, max: 60000 },
      stepInterval: { type: Number, required: true, min: 0, max: 3600 },
      storageVoltage: { type: Number, required: true, min: 0, max: 60 },
    },
    waveform: {
      type: [Number],
      default: [],
    },
    measuredEnergyJ: {
      type: Number,
      default: null,
    },
    measurementQuality: {
      type: String,
      default: 'VALID',
    },
    featureVersion: {
      type: String,
      default: 'features-v1',
    },
    modelVersion: {
      type: String,
      default: null,
    },
    label: {
      type: String,
      enum: ['LIGHT', 'NORMAL', 'HEAVY'],
      required: true,
      index: true,
    },
    rejected: {
      type: Boolean,
      default: false,
      index: true,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    source: {
      type: String,
      enum: ['live', 'demo'],
      default: 'live',
      index: true,
    },
    note: {
      type: String,
      maxlength: 280,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
)

DatasetSampleSchema.index({ deviceId: 1, timestamp: -1 })
DatasetSampleSchema.index({ participantId: 1, label: 1 })
DatasetSampleSchema.index({ sessionId: 1, rejected: 1 })

export const DatasetSample = mongoose.model<IDatasetSample>('DatasetSample', DatasetSampleSchema)
