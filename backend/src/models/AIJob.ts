import mongoose, { Schema, Document } from 'mongoose'

export type AIJobType = 'TRAIN_MODEL' | 'RUN_ANOMALY_ANALYSIS' | 'GENERATE_FORECAST' | 'FEATURE_STUDY'
export type AIJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface IAIJob extends Document {
  jobId: string
  type: AIJobType
  status: AIJobStatus
  datasetVersion?: string
  modelVersion?: string
  featureVersion?: string
  startedAt?: Date
  completedAt?: Date
  metrics?: Record<string, any>
  error?: string | null
  createdBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const AIJobSchema = new Schema<IAIJob>(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['TRAIN_MODEL', 'RUN_ANOMALY_ANALYSIS', 'GENERATE_FORECAST', 'FEATURE_STUDY'],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'],
      default: 'QUEUED',
      index: true,
    },
    datasetVersion: {
      type: String,
    },
    modelVersion: {
      type: String,
    },
    featureVersion: {
      type: String,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    metrics: {
      type: Schema.Types.Mixed,
      default: {},
    },
    error: {
      type: String,
      default: null,
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

AIJobSchema.index({ type: 1, status: 1, createdAt: -1 })

export const AIJob = mongoose.model<IAIJob>('AIJob', AIJobSchema)
