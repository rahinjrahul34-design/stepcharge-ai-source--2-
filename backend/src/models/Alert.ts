import mongoose, { Schema, Document } from 'mongoose'

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'success'
export type AlertCategory = 'HARDWARE' | 'ENERGY' | 'AI' | 'NETWORK' | 'SYSTEM'

export interface IAlert extends Document {
  deviceId: string
  userId?: mongoose.Types.ObjectId
  category: AlertCategory
  type: string
  title: string
  reason: string
  severity: AlertSeverity
  currentValue?: string
  threshold?: string
  action?: string
  resolved: boolean
  resolvedAt?: Date
  resolvedBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const AlertSchema = new Schema<IAlert>(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    category: {
      type: String,
      enum: ['HARDWARE', 'ENERGY', 'AI', 'NETWORK', 'SYSTEM'],
      default: 'SYSTEM',
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      default: '',
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical', 'success'],
      default: 'warning',
      index: true,
    },
    currentValue: {
      type: String,
      default: '',
    },
    threshold: {
      type: String,
      default: '',
    },
    action: {
      type: String,
      default: '',
    },
    resolved: {
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

AlertSchema.index({ deviceId: 1, createdAt: -1 })
AlertSchema.index({ resolved: 1, createdAt: -1 })

export const Alert = mongoose.model<IAlert>('Alert', AlertSchema)
