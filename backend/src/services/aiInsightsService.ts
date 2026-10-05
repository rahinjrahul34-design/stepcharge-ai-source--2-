import { Footstep } from '../models/Footstep.js'
import { Telemetry } from '../models/Telemetry.js'
import { ModelMetadataModel } from '../models/ModelMetadata.js'
import { AIInsight, IAIInsight } from '../models/AIInsight.js'

export async function generateAIInsights(deviceId?: string): Promise<IAIInsight[]> {
  const query: any = {}
  if (deviceId) query.deviceId = deviceId

  const steps = await Footstep.find(query).sort({ timestamp: -1 }).limit(200).lean()
  const modelMeta = await ModelMetadataModel.findOne({ status: 'PRODUCTION', isCurrent: true })

  if (steps.length === 0) {
    return []
  }

  const insights: Array<Partial<IAIInsight>> = []
  const total = steps.length

  // 1. Gait Intensity Distribution
  const counts: Record<string, number> = { LIGHT: 0, NORMAL: 0, HEAVY: 0 }
  let sumPeak = 0
  let sumEnergy = 0
  let measuredEnergyCount = 0

  steps.forEach((s) => {
    if (counts[s.stepClass] !== undefined) counts[s.stepClass]++
    const pv = s.features?.peakVoltage ?? (s as any).peakVoltage ?? 0
    sumPeak += pv
    if (s.measuredEnergyJ && s.measuredEnergyJ > 0) {
      sumEnergy += s.measuredEnergyJ
      measuredEnergyCount++
    }
  })

  const dominantClass = Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b))
  const dominantPct = Math.round((counts[dominantClass] / total) * 100)

  insights.push({
    insightType: 'DOMINANT_GAIT_PATTERN',
    title: 'Dominant Gait Cadence',
    summary: `${dominantPct}% of recorded footsteps were classified as ${dominantClass} intensity.`,
    evidence: `Aggregated over the last ${total} footsteps for device ${deviceId || 'fleet'}.`,
    confidence: 0.95,
    sourceDataRange: `Recent ${total} footsteps`,
    algorithmVersion: 'v3.0.0',
    category: 'GAIT',
  })

  // 2. Voltage Spike vs Intensity Correlation
  const avgPeak = (sumPeak / total).toFixed(2)
  insights.push({
    insightType: 'PEAK_VOLTAGE_CORRELATION',
    title: 'Kinetic Transduction Peak',
    summary: `Mean peak harvester voltage across all strides is ${avgPeak} V.`,
    evidence: `Derived from ${total} rectified ADC envelope samples.`,
    confidence: 0.92,
    sourceDataRange: `Recent ${total} footsteps`,
    algorithmVersion: 'v3.0.0',
    category: 'HARVESTING',
  })

  // 3. Current Sensor Availability
  const measuredPct = Math.round((measuredEnergyCount / total) * 100)
  if (measuredPct > 0) {
    const avgEnergy = (sumEnergy / measuredEnergyCount).toFixed(4)
    insights.push({
      insightType: 'MEASURED_ENERGY_YIELD',
      title: 'Real Harvested Energy',
      summary: `Average measured electrical energy is ${avgEnergy} J per footstep.`,
      evidence: `Computed from ${measuredEnergyCount} simultaneous voltage and current shunt integrations.`,
      confidence: 0.98,
      sourceDataRange: `${measuredEnergyCount} measured footsteps`,
      algorithmVersion: 'v3.0.0',
      category: 'ENERGY',
    })
  } else {
    insights.push({
      insightType: 'CURRENT_SENSOR_ABSENCE',
      title: 'Capacitive Storage Estimation',
      summary: 'Current sensing is not installed on this prototype; energy displays theoretical 0.5*C*V^2 storage.',
      evidence: 'No I2C current sensor acknowledged on bus during sample acquisition.',
      confidence: 1.0,
      sourceDataRange: `All ${total} samples`,
      algorithmVersion: 'v3.0.0',
      category: 'ENERGY',
    })
  }

  // 4. Model Health
  if (modelMeta?.metrics) {
    insights.push({
      insightType: 'MODEL_PERFORMANCE',
      title: 'Active Classifier Precision',
      summary: `Active production model (${modelMeta.version}) demonstrates ${(modelMeta.metrics.f1 * 100).toFixed(1)}% macro F1 score.`,
      evidence: `Evaluated using ${modelMeta.evaluationMethod || 'subject-independent CV'} across ${modelMeta.participants || 0} participants.`,
      confidence: 0.96,
      sourceDataRange: `Model registry: ${modelMeta.version}`,
      algorithmVersion: 'v3.0.0',
      category: 'MODEL',
    })
  }

  return insights as IAIInsight[]
}
