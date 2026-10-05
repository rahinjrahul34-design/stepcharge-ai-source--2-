import mongoose, { Schema, Document } from 'mongoose'

export type CalibrationType = 'VOLTAGE' | 'CURRENT' | 'PIEZO_THRESHOLD' | 'STORAGE_VOLTAGE'

export interface ICalibrationLog extends Document {
  deviceId: string
  calibrationType: CalibrationType
  performedBy: mongoose.Types.ObjectId
  userEmail: string
  timestamp: Date
  referenceValue: number
  measuredValue: number
  previousScale: number
  newScale: number
  previousOffset: number
  newOffset: number
  errorPercent: number
  result: 'PASS' | 'FAIL' | 'APPLIED'
  notes?: string
  createdAt: Date
}

const CalibrationLogSchema = new Schema<ICalibrationLog>(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    calibrationType: {
      type: String,
      enum: ['VOLTAGE', 'CURRENT', 'PIEZO_THRESHOLD', 'STORAGE_VOLTAGE'],
      required: true,
      index: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    referenceValue: {
      type: Number,
      required: true,
    },
    measuredValue: {
      type: Number,
      required: true,
    },
    previousScale: {
      type: Number,
      default: 1.0,
    },
    newScale: {
      type: Number,
      required: true,
    },
    previousOffset: {
      type: Number,
      default: 0.0,
    },
    newOffset: {
      type: Number,
      required: true,
    },
    errorPercent: {
      type: Number,
      required: true,
    },
    result: {
      type: String,
      enum: ['PASS', 'FAIL', 'APPLIED'],
      default: 'APPLIED',
    },
    notes: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
)

CalibrationLogSchema.index({ deviceId: 1, timestamp: -1 })

export const CalibrationLog = mongoose.model<ICalibrationLog>('CalibrationLog', CalibrationLogSchema)
