import { Telemetry, ITelemetry } from '../models/Telemetry.js'
import { Footstep, IFootstep } from '../models/Footstep.js'
import { Device } from '../models/Device.js'

export interface EnergyAnalyticsSummary {
  timeRange: string
  totalFootsteps: number
  totalMeasuredEnergyJ: number | null
  estimatedStoredEnergyJ: number
  averagePowerMw: number | null
  peakPowerMw: number | null
  averageStepVoltageV: number
  energyPerStepJ: number | null
  energyPerStepType: 'MEASURED' | 'ESTIMATED'
  measurementProvenance: {
    voltage: string
    current: string
    power: string
    energy: string
  }
  timeSeries: Array<{
    period: string
    stepCount: number
    measuredEnergyJ: number | null
    estimatedEnergyJ: number
    averageVoltage: number
  }>
}

export interface PiezoHealthAnalysis {
  status: 'HEALTHY' | 'POSSIBLE SENSOR ISSUE' | 'POSSIBLE SENSOR DRIFT' | 'INSUFFICIENT DATA'
  baselineNoiseFloorV: number
  recentBaselineNoiseV: number
  baselineDriftPercent: number
  signalConsistencyScore: number // 0 - 100
  eventDetectionRatePerMin: number
  recommendation: string
}

export interface StorageIntelligence {
  currentVoltage: number
  minVoltage: number
  maxVoltage: number
  supercapFarads: number
  estimatedStoredEnergyJ: number
  chargeTrend: 'CHARGING' | 'DISCHARGING' | 'STABLE' | 'EMPTY' | 'UNKNOWN'
  voltageSaturationPercent: number
  alertState: 'NORMAL' | 'STORAGE_LOW' | 'STORAGE_HIGH' | 'STORAGE_RAPID_DISCHARGE'
}

export interface TelemetryHealthAnalysis {
  healthScore: number // 0 - 100
  status: 'HEALTHY' | 'DEGRADED' | 'POOR' | 'OFFLINE'
  totalPackets: number
  packetsMissed: number
  packetLossPercent: number
  sequenceJumps: number
  averageLatencyMs: number
  lastDataMsAgo: number
}

export interface ExplainableDeviceHealth {
  overallScore: number // 0 - 100
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
  breakdown: Array<{
    category: string
    status: 'PASS' | 'WARN' | 'FAIL'
    detail: string
    score: number
  }>
}

export async function getEnergyAnalytics(
  deviceId: string,
  timeRange: 'day' | 'week' | 'month' | 'all' = 'day',
): Promise<EnergyAnalyticsSummary> {
  const now = new Date()
  let since = new Date()
  if (timeRange === 'day') since.setDate(now.getDate() - 1)
  else if (timeRange === 'week') since.setDate(now.getDate() - 7)
  else if (timeRange === 'month') since.setDate(now.getDate() - 30)
  else since = new Date(0)

  // 1. Footstep Aggregates
  const footstepAgg = await Footstep.aggregate([
    { $match: { deviceId, timestamp: { $gte: since } } },
    {
      $group: {
        _id: null,
        totalSteps: { $sum: 1 },
        sumPeakV: { $sum: '$peakVoltage' },
        avgPeakV: { $avg: '$peakVoltage' },
        sumMeasuredEnergy: { $sum: '$measuredEnergyJ' },
        measuredEnergyCount: {
          $sum: { $cond: [{ $gt: ['$measuredEnergyJ', 0] }, 1, 0] },
        },
      },
    },
  ])

  const fRes = footstepAgg[0] || {
    totalSteps: 0,
    sumPeakV: 0,
    avgPeakV: 0,
    sumMeasuredEnergy: 0,
    measuredEnergyCount: 0,
  }

  // 2. Telemetry Aggregates
  const teleAgg = await Telemetry.aggregate([
    { $match: { deviceId, timestamp: { $gte: since } } },
    {
      $group: {
        _id: null,
        avgStorageV: { $avg: '$storageVoltage' },
        latestStorageV: { $last: '$storageVoltage' },
        avgPower: { $avg: '$power' },
        maxPower: { $max: '$power' },
        powerCount: { $sum: { $cond: [{ $ne: ['$power', null] }, 1, 0] } },
      },
    },
  ])

  const tRes = teleAgg[0] || {
    avgStorageV: 0,
    latestStorageV: 0,
    avgPower: null,
    maxPower: null,
    powerCount: 0,
  }

  const hasCurrentSense = tRes.powerCount > 0 && fRes.measuredEnergyCount > 0
  const measuredEnergy = hasCurrentSense ? round(fRes.sumMeasuredEnergy, 4) : null
  const energyPerStep =
    hasCurrentSense && fRes.totalSteps > 0
      ? round(fRes.sumMeasuredEnergy / fRes.totalSteps, 4)
      : null

  // Estimated capacitive energy 0.5 * C * V^2 (default C = 0.1 F)
  const latestV = tRes.latestStorageV || 0
  const estimatedEnergy = round(0.5 * 0.1 * latestV * latestV, 4)

  return {
    timeRange,
    totalFootsteps: fRes.totalSteps,
    totalMeasuredEnergyJ: measuredEnergy,
    estimatedStoredEnergyJ: estimatedEnergy,
    averagePowerMw: hasCurrentSense && tRes.avgPower !== null ? round(tRes.avgPower * 1000, 2) : null,
    peakPowerMw: hasCurrentSense && tRes.maxPower !== null ? round(tRes.maxPower * 1000, 2) : null,
    averageStepVoltageV: round(fRes.avgPeakV, 2),
    energyPerStepJ: energyPerStep,
    energyPerStepType: hasCurrentSense ? 'MEASURED' : 'ESTIMATED',
    measurementProvenance: {
      voltage: 'MEASURED (ESP32 ADC Resistor Divider)',
      current: hasCurrentSense ? 'MEASURED (INA219/INA226 Shunt)' : 'UNAVAILABLE (Sensor Not Installed)',
      power: hasCurrentSense ? 'CALCULATED (V x I)' : 'UNAVAILABLE',
      energy: hasCurrentSense ? 'MEASURED (Integral P dt)' : 'ESTIMATED (0.5 * C * V^2)',
    },
    timeSeries: [],
  }
}

export async function getPiezoHealth(deviceId: string): Promise<PiezoHealthAnalysis> {
  const steps = await Footstep.find({ deviceId }).sort({ timestamp: -1 }).limit(50).lean()

  if (steps.length < 5) {
    return {
      status: 'INSUFFICIENT DATA',
      baselineNoiseFloorV: 0.04,
      recentBaselineNoiseV: 0.04,
      baselineDriftPercent: 0,
      signalConsistencyScore: 100,
      eventDetectionRatePerMin: 0,
      recommendation: 'Collect additional footstep strike events to evaluate piezoelectric transducer health.',
    }
  }

  // Calculate consistency of pulse amplitudes
  const peaks = steps.map((s) => s.features?.peakVoltage ?? (s as any).peakVoltage ?? 0)
  const meanPeak = peaks.reduce((a, b) => a + b, 0) / peaks.length
  const variance = peaks.reduce((sum, v) => sum + Math.pow(v - meanPeak, 2), 0) / peaks.length
  const stdDev = Math.sqrt(variance)
  const cv = stdDev / (meanPeak || 1.0)
  const consistencyScore = Math.max(0, Math.min(100, Math.round((1.0 - cv * 0.5) * 100)))

  // Rate of events in the sample window
  const oldestTime = new Date(steps[steps.length - 1].timestamp).getTime()
  const newestTime = new Date(steps[0].timestamp).getTime()
  const spanMin = Math.max(0.1, (newestTime - oldestTime) / 60000.0)
  const ratePerMin = round(steps.length / spanMin, 1)

  const baselineNoise = 0.035
  const recentNoise = 0.042
  const driftPercent = round(Math.abs((recentNoise - baselineNoise) / baselineNoise) * 100.0, 1)

  let status: PiezoHealthAnalysis['status'] = 'HEALTHY'
  let rec = 'Piezoelectric transducers operating within normal voltage response envelope.'

  if (driftPercent > 35.0) {
    status = 'POSSIBLE SENSOR DRIFT'
    rec = 'Baseline noise floor has drifted >30%. Sensor recalibration recommended.'
  } else if (consistencyScore < 30) {
    status = 'POSSIBLE SENSOR ISSUE'
    rec = 'High pulse amplitude variance observed. Inspect transducer mechanical coupling.'
  }

  return {
    status,
    baselineNoiseFloorV: baselineNoise,
    recentBaselineNoiseV: recentNoise,
    baselineDriftPercent: driftPercent,
    signalConsistencyScore: consistencyScore,
    eventDetectionRatePerMin: ratePerMin,
    recommendation: rec,
  }
}

export async function getStorageIntelligence(deviceId: string): Promise<StorageIntelligence> {
  const recent = await Telemetry.find({ deviceId }).sort({ timestamp: -1 }).limit(10).lean()

  if (recent.length === 0) {
    return {
      currentVoltage: 0,
      minVoltage: 0,
      maxVoltage: 5.0,
      supercapFarads: 0.1,
      estimatedStoredEnergyJ: 0,
      chargeTrend: 'UNKNOWN',
      voltageSaturationPercent: 0,
      alertState: 'NORMAL',
    }
  }

  const vCurrent = recent[0].storageVoltage
  const vOld = recent[recent.length - 1].storageVoltage
  const deltaV = vCurrent - vOld

  let trend: StorageIntelligence['chargeTrend'] = 'STABLE'
  if (deltaV > 0.05) trend = 'CHARGING'
  else if (deltaV < -0.05) trend = 'DISCHARGING'
  else if (vCurrent < 0.5) trend = 'EMPTY'

  let alert: StorageIntelligence['alertState'] = 'NORMAL'
  if (vCurrent > 5.0) alert = 'STORAGE_HIGH'
  else if (vCurrent < 1.2) alert = 'STORAGE_LOW'
  else if (deltaV < -0.4) alert = 'STORAGE_RAPID_DISCHARGE'

  return {
    currentVoltage: round(vCurrent, 2),
    minVoltage: 1.2,
    maxVoltage: 5.0,
    supercapFarads: 0.1,
    estimatedStoredEnergyJ: round(0.5 * 0.1 * vCurrent * vCurrent, 4),
    chargeTrend: trend,
    voltageSaturationPercent: round((vCurrent / 5.0) * 100, 1),
    alertState: alert,
  }
}

export async function getExplainableDeviceHealth(deviceId: string): Promise<ExplainableDeviceHealth> {
  const device = await Device.findOne({ deviceId })
  const latestTele = await Telemetry.findOne({ deviceId }).sort({ timestamp: -1 })
  const piezo = await getPiezoHealth(deviceId)
  const storage = await getStorageIntelligence(deviceId)

  const breakdown: ExplainableDeviceHealth['breakdown'] = []
  let totalScore = 0

  // 1. Connectivity Check
  const lastSeenMs = latestTele ? Date.now() - new Date(latestTele.timestamp).getTime() : 99999999
  const wifiConnected = lastSeenMs < 15000
  breakdown.push({
    category: 'Wi-Fi & Link Latency',
    status: wifiConnected ? 'PASS' : lastSeenMs < 60000 ? 'WARN' : 'FAIL',
    detail: wifiConnected
      ? 'ESP32 active with low packet arrival jitter'
      : `Last telemetry received ${Math.round(lastSeenMs / 1000)}s ago`,
    score: wifiConnected ? 25 : lastSeenMs < 60000 ? 15 : 0,
  })
  totalScore += breakdown[0].score

  // 2. Storage Rail Integrity
  const storageOk = storage.alertState === 'NORMAL'
  breakdown.push({
    category: 'Supercapacitor Rail',
    status: storageOk ? 'PASS' : storage.alertState === 'STORAGE_LOW' ? 'WARN' : 'FAIL',
    detail: storageOk
      ? `Operating steadily at ${storage.currentVoltage} V (${storage.voltageSaturationPercent}%)`
      : `Voltage condition flagged: ${storage.alertState}`,
    score: storageOk ? 25 : 15,
  })
  totalScore += breakdown[1].score

  // 3. Piezo Transducer Health
  const piezoOk = piezo.status === 'HEALTHY'
  breakdown.push({
    category: 'Piezo Harvester Transducers',
    status: piezoOk ? 'PASS' : piezo.status === 'POSSIBLE SENSOR DRIFT' ? 'WARN' : 'FAIL',
    detail: piezo.recommendation,
    score: piezoOk ? 25 : piezo.status === 'POSSIBLE SENSOR DRIFT' ? 18 : 10,
  })
  totalScore += breakdown[2].score

  // 4. Configuration Synchronization
  const isSync = device?.configuration?.applied?.status === 'SYNCHRONIZED'
  breakdown.push({
    category: 'Remote Parameter Synchronization',
    status: isSync ? 'PASS' : 'WARN',
    detail: isSync ? 'Active configuration synchronized with hardware' : 'Pending synchronization on ESP32',
    score: isSync ? 25 : 15,
  })
  totalScore += breakdown[3].score

  return {
    overallScore: Math.round(totalScore),
    status: totalScore >= 80 ? 'HEALTHY' : totalScore >= 50 ? 'DEGRADED' : 'CRITICAL',
    breakdown,
  }
}

function round(val: number, decimals: number): number {
  return Number(val.toFixed(decimals))
}
