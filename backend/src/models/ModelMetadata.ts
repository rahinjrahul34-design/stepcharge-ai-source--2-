import mongoose, { Schema, Document } from 'mongoose'

export type ModelStatus = 'PRODUCTION' | 'VALIDATION' | 'ARCHIVED'

export interface IRollbackRecord {
  fromVersion: string
  toVersion: string
  reason: string
  performedBy?: string
  timestamp: Date
}

export interface IModelMetadataDoc extends Document {
  modelName: string
  version: string
  algorithm: string
  status: ModelStatus
  datasetVersion?: string
  featureVersion: string
  featureCount: number
  classes: string[]
  metrics?: {
    accuracy: number
    precision: number
    recall: number
    f1: number
    mae?: number
    rmse?: number
  }
  confusionMatrix?: number[][]
  featureImportance?: Record<string, number>
  samples?: {
    total: number
    train: number
    test: number
  }
  labelDistribution?: Record<string, number>
  evaluationMethod?: string
  evaluationDetail?: string
  subjectIndependent?: boolean
  participants?: number
  inferenceTimeMs?: number
  modelSizeKb?: number
  hyperparameters?: Record<string, any>
  warnings?: string[]
  trainedAt?: Date
  promotedAt?: Date
  promotedBy?: mongoose.Types.ObjectId
  rollbackHistory: IRollbackRecord[]
  isCurrent: boolean
  createdAt: Date
  updatedAt: Date
}

const ModelMetadataSchema = new Schema<IModelMetadataDoc>(
  {
    modelName: {
      type: String,
      required: true,
      default: 'Random Forest (scikit-learn)',
    },
    version: {
      type: String,
      required: true,
      index: true,
    },
    algorithm: {
      type: String,
      default: 'Random Forest',
    },
    status: {
      type: String,
      enum: ['PRODUCTION', 'VALIDATION', 'ARCHIVED'],
      default: 'PRODUCTION',
      index: true,
    },
    datasetVersion: {
      type: String,
    },
    featureVersion: {
      type: String,
      default: 'features-v1',
    },
    featureCount: {
      type: Number,
      default: 5,
    },
    classes: {
      type: [String],
      default: ['LIGHT', 'NORMAL', 'HEAVY'],
    },
    metrics: {
      accuracy: { type: Number },
      precision: { type: Number },
      recall: { type: Number },
      f1: { type: Number },
      mae: { type: Number },
      rmse: { type: Number },
    },
    confusionMatrix: {
      type: [[Number]],
    },
    featureImportance: {
      type: Map,
      of: Number,
    },
    samples: {
      total: { type: Number },
      train: { type: Number },
      test: { type: Number },
    },
    labelDistribution: {
      type: Map,
      of: Number,
    },
    evaluationMethod: {
      type: String,
    },
    evaluationDetail: {
      type: String,
    },
    subjectIndependent: {
      type: Boolean,
      default: false,
    },
    participants: {
      type: Number,
      default: 0,
    },
    inferenceTimeMs: {
      type: Number,
      default: 0,
    },
    modelSizeKb: {
      type: Number,
      default: 0,
    },
    hyperparameters: {
      type: Schema.Types.Mixed,
    },
    warnings: {
      type: [String],
      default: [],
    },
    trainedAt: {
      type: Date,
    },
    promotedAt: {
      type: Date,
    },
    promotedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    rollbackHistory: [
      {
        fromVersion: { type: String, required: true },
        toVersion: { type: String, required: true },
        reason: { type: String, required: true },
        performedBy: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    isCurrent: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
)

ModelMetadataSchema.index({ status: 1, createdAt: -1 })
ModelMetadataSchema.index({ version: 1, isCurrent: 1 })

export const ModelMetadataModel = mongoose.model<IModelMetadataDoc>('ModelMetadata', ModelMetadataSchema)
