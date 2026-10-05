import mongoose, { Schema, Document } from 'mongoose'

export interface IAIInsight extends Document {
  insightType: string
  title: string
  summary: string
  evidence: string
  confidence: number
  sourceDataRange: string
  algorithmVersion: string
  category: 'ENERGY' | 'GAIT' | 'HARVESTING' | 'STORAGE' | 'MODEL'
  createdAt: Date
}

const AIInsightSchema = new Schema<IAIInsight>(
  {
    insightType: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    summary: {
      type: String,
      required: true,
    },
    evidence: {
      type: String,
      required: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    sourceDataRange: {
      type: String,
      required: true,
    },
    algorithmVersion: {
      type: String,
      required: true,
      default: 'v3.0.0',
    },
    category: {
      type: String,
      required: true,
      enum: ['ENERGY', 'GAIT', 'HARVESTING', 'STORAGE', 'MODEL'],
      default: 'GAIT',
      index: true,
    },
  },
  {
    timestamps: true,
  },
)

AIInsightSchema.index({ category: 1, createdAt: -1 })

export const AIInsight = mongoose.model<IAIInsight>('AIInsight', AIInsightSchema)
