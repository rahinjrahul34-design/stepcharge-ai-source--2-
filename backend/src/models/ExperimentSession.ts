import mongoose, { Schema, Document } from 'mongoose'

export type ExperimentStatus = 'PLANNED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'

export interface IExperimentSession extends Document {
  sessionId: string
  experimentName: string
  description?: string
  operator?: string
  location?: string
  participantId: string // Anonymized, e.g., 'P001'
  deviceId: string
  stepClass: 'LIGHT' | 'NORMAL' | 'HEAVY'
  targetSteps: number
  collectedSteps: number
  validSteps: number
  rejectedSteps: number
  hardwareVersion?: string
  firmwareVersion?: string
  calibrationVersion?: string
  datasetVersion?: string
  environment?: string
  status: ExperimentStatus
  startedAt?: Date
  completedAt?: Date
  notes?: string
  metrics?: {
    totalSteps: number
    validSteps: number
    rejectedSteps: number
    avgPeakVoltage: number
    avgPulseDuration: number
    totalEnergyJ: number | null
    energyPerStepJ: number | null
    energyPerStepType: 'MEASURED' | 'ESTIMATED'
  }
  createdBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const ExperimentSessionSchema = new Schema<IExperimentSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    experimentName: {
      type: String,
      required: true,
      trim: true,
    },
    participantId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    stepClass: {
      type: String,
      enum: ['LIGHT', 'NORMAL', 'HEAVY'],
      required: true,
    },
    targetSteps: {
      type: Number,
      required: true,
      min: 1,
      max: 10000,
    },
    collectedSteps: {
      type: Number,
      default: 0,
      min: 0,
    },
    validSteps: {
      type: Number,
      default: 0,
      min: 0,
    },
    rejectedSteps: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['PLANNED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED'],
      default: 'PLANNED',
      index: true,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    description: { type: String, maxlength: 2000 },
    operator: { type: String, trim: true },
    location: { type: String, trim: true },
    hardwareVersion: { type: String, default: 'mat-v2.1' },
    firmwareVersion: { type: String, default: '2.1.0' },
    calibrationVersion: { type: String, default: 'cal-v1.0' },
    datasetVersion: { type: String, default: 'dataset-v1' },
    environment: { type: String, trim: true },
    metrics: {
      totalSteps: { type: Number, default: 0 },
      validSteps: { type: Number, default: 0 },
      rejectedSteps: { type: Number, default: 0 },
      avgPeakVoltage: { type: Number, default: 0 },
      avgPulseDuration: { type: Number, default: 0 },
      totalEnergyJ: { type: Number, default: null },
      energyPerStepJ: { type: Number, default: null },
      energyPerStepType: { type: String, enum: ['MEASURED', 'ESTIMATED'], default: 'ESTIMATED' },
    },
    notes: {
      type: String,
      maxlength: 1000,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
)

ExperimentSessionSchema.index({ deviceId: 1, status: 1 })
ExperimentSessionSchema.index({ participantId: 1, stepClass: 1 })

export const ExperimentSession = mongoose.model<IExperimentSession>('ExperimentSession', ExperimentSessionSchema)
