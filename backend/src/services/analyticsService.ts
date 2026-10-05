import { Footstep } from '../models/Footstep.js'
import { Telemetry } from '../models/Telemetry.js'

export interface AnalyticsQuery {
  deviceId: string
  startDate?: Date
  endDate?: Date
}

export async function getFootstepAnalytics(q: AnalyticsQuery) {
  const match: Record<string, unknown> = { deviceId: q.deviceId }
  if (q.startDate || q.endDate) {
    match.timestamp = {}
    if (q.startDate) (match.timestamp as Record<string, unknown>).$gte = q.startDate
    if (q.endDate) (match.timestamp as Record<string, unknown>).$lte = q.endDate
  }

  // 1. Aggregation by class distribution & energy
  const classAggregation = await Footstep.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$stepClass',
        count: { $sum: 1 },
        totalEnergy: { $sum: '$estimatedEnergyJ' },
        avgPeakVoltage: { $avg: '$features.peakVoltage' },
        avgDuration: { $avg: '$features.pulseDuration' },
      },
    },
  ])

  // 2. Hourly breakdown
  const hourlyAggregation = await Footstep.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          hour: { $dateToString: { format: '%H:00', date: '$timestamp' } },
          stepClass: '$stepClass',
        },
        count: { $sum: 1 },
        energy: { $sum: '$estimatedEnergyJ' },
      },
    },
    { $sort: { '_id.hour': 1 } },
  ])

  // 3. Overall summary metrics
  const totals = await Footstep.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalSteps: { $sum: 1 },
        totalEnergyJ: { $sum: '$estimatedEnergyJ' },
        maxPeakVoltage: { $max: '$features.peakVoltage' },
        avgPeakVoltage: { $avg: '$features.peakVoltage' },
        avgConfidence: { $avg: '$confidence' },
        avgInterval: { $avg: '$features.stepInterval' },
      },
    },
  ])

  return {
    summary: totals[0] || {
      totalSteps: 0,
      totalEnergyJ: 0,
      maxPeakVoltage: 0,
      avgPeakVoltage: 0,
      avgConfidence: 0,
      avgInterval: 0,
    },
    classDistribution: classAggregation,
    hourly: hourlyAggregation,
  }
}

export async function getVoltageTrends(deviceId: string, limit = 100) {
  const points = await Telemetry.find({ deviceId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .select('timestamp peakVoltage averageVoltage storageVoltage')
    .lean()

  return points.reverse().map((p) => ({
    timestamp: p.timestamp,
    peakVoltage: p.peakVoltage,
    averageVoltage: p.averageVoltage,
    storageVoltage: p.storageVoltage,
  }))
}
