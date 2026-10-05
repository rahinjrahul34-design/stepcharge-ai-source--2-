import mongoose, { Schema, Document } from 'mongoose'

export type AnomalyType =
  | 'VOLTAGE_SPIKE'
  | 'VOLTAGE_DROP'
  | 'UNUSUAL_PULSE'
  | 'UNUSUAL_STEP_INTERVAL'
  | 'LOW_ENERGY'
  | 'HIGH_ENERGY'
  | 'SENSOR_FAILURE'
  | 'SENSOR_DRIFT'
  | 'TELEMETRY_GAP'
  | 'POSSIBLE_DUPLICATE'
  | 'STORAGE_ANOMALY'

export type AnomalySeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type AnomalySource = 'RULE-BASED' | 'ML-BASED'
export type AnomalyStatus = 'NORMAL' | 'SUSPICIOUS' | 'ANOMALOUS'

export interface IAnomalyEvent extends Document {
  deviceId: string
  timestamp: Date
  anomalyType: AnomalyType
  severity: AnomalySeverity
  source: AnomalySource
  anomalyScore?: number | null
  status: AnomalyStatus
  observedValue: number | string
  typicalRange: string
  possibleCause: string
  evidence: Record<string, any>
  isResolved: boolean
  resolvedAt?: Date
  resolvedBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const AnomalyEventSchema = new Schema<IAnomalyEvent>(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    anomalyType: {
      type: String,
      required: true,
      enum: [
        'VOLTAGE_SPIKE',
        'VOLTAGE_DROP',
        'UNUSUAL_PULSE',
        'UNUSUAL_STEP_INTERVAL',
        'LOW_ENERGY',
        'HIGH_ENERGY',
        'SENSOR_FAILURE',
        'SENSOR_DRIFT',
        'TELEMETRY_GAP',
        'POSSIBLE_DUPLICATE',
        'STORAGE_ANOMALY',
      ],
      index: true,
    },
    severity: {
      type: String,
      required: true,
      enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      index: true,
    },
    source: {
      type: String,
      required: true,
      enum: ['RULE-BASED', 'ML-BASED'],
      default: 'RULE-BASED',
    },
    anomalyScore: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: ['NORMAL', 'SUSPICIOUS', 'ANOMALOUS'],
      default: 'ANOMALOUS',
      index: true,
    },
    observedValue: {
      type: Schema.Types.Mixed,
      required: true,
    },
    typicalRange: {
      type: String,
      required: true,
      default: 'N/A',
    },
    possibleCause: {
      type: String,
      required: true,
      default: 'UNKNOWN',
    },
    evidence: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isResolved: {
      type: Boolean,
      default: false,
      index: true,
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
)

AnomalyEventSchema.index({ deviceId: 1, timestamp: -1 })
AnomalyEventSchema.index({ isResolved: 1, severity: 1, timestamp: -1 })

export const AnomalyEvent = mongoose.model<IAnomalyEvent>('AnomalyEvent', AnomalyEventSchema)
