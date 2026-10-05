import mongoose, { Schema, Document } from 'mongoose'

export interface IDatasetVersion extends Document {
  datasetVersion: string // e.g. 'dataset-v1'
  createdAt: Date
  sampleCount: number
  participantCount: number
  featureVersion: string // 'features-v1', 'features-v2', 'features-v3'
  classDistribution: {
    LIGHT: number
    NORMAL: number
    HEAVY: number
  }
  qualitySummary: {
    missingValuesCount: number
    outliersCount: number
    qualityScore: number // 0 - 100
    rejectedCount: number
    waveformAvailabilityPercent: number
    measuredEnergyAvailabilityPercent: number
  }
  isFrozen: boolean
  notes?: string
  createdBy?: mongoose.Types.ObjectId
}

const DatasetVersionSchema = new Schema<IDatasetVersion>(
  {
    datasetVersion: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    sampleCount: {
      type: Number,
      required: true,
      default: 0,
    },
    participantCount: {
      type: Number,
      required: true,
      default: 0,
    },
    featureVersion: {
      type: String,
      required: true,
      default: 'features-v1',
    },
    classDistribution: {
      LIGHT: { type: Number, default: 0 },
      NORMAL: { type: Number, default: 0 },
      HEAVY: { type: Number, default: 0 },
    },
    qualitySummary: {
      missingValuesCount: { type: Number, default: 0 },
      outliersCount: { type: Number, default: 0 },
      qualityScore: { type: Number, default: 100 },
      rejectedCount: { type: Number, default: 0 },
      waveformAvailabilityPercent: { type: Number, default: 0 },
      measuredEnergyAvailabilityPercent: { type: Number, default: 0 },
    },
    isFrozen: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: '',
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

DatasetVersionSchema.index({ createdAt: -1 })

export const DatasetVersion = mongoose.model<IDatasetVersion>('DatasetVersion', DatasetVersionSchema)
