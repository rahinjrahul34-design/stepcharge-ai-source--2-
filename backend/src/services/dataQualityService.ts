import { DatasetSample, IDatasetSample } from '../models/DatasetSample.js'
import { DatasetVersion, IDatasetVersion } from '../models/DatasetVersion.js'
import mongoose from 'mongoose'

export interface QualityValidationResult {
  isValid: boolean
  qualityScore: number
  totalSamples: number
  uniqueParticipants: number
  missingValuesCount: number
  outliersCount: number
  rejectedCount: number
  waveformAvailabilityPercent: number
  measuredEnergyAvailabilityPercent: number
  classDistribution: {
    LIGHT: number
    NORMAL: number
    HEAVY: number
  }
  isReadyForTraining: boolean
  recommendations: string[]
}

export async function validateDatasetQuality(
  samples: Array<Partial<IDatasetSample>>,
): Promise<QualityValidationResult> {
  const total = samples.length
  if (total === 0) {
    return {
      isValid: false,
      qualityScore: 0,
      totalSamples: 0,
      uniqueParticipants: 0,
      missingValuesCount: 0,
      outliersCount: 0,
      rejectedCount: 0,
      waveformAvailabilityPercent: 0,
      measuredEnergyAvailabilityPercent: 0,
      classDistribution: { LIGHT: 0, NORMAL: 0, HEAVY: 0 },
      isReadyForTraining: false,
      recommendations: ['Dataset is completely empty. Collect gait footstep samples before training.'],
    }
  }

  let missingCount = 0
  let outlierCount = 0
  let rejectedCount = 0
  let waveformCount = 0
  let measuredEnergyCount = 0
  const participants = new Set<string>()
  const classDist = { LIGHT: 0, NORMAL: 0, HEAVY: 0 }

  for (const s of samples) {
    if (s.participantId) participants.add(s.participantId)
    if (s.waveform && s.waveform.length >= 5) waveformCount++
    if (s.measuredEnergyJ !== null && s.measuredEnergyJ !== undefined && s.measuredEnergyJ > 0) {
      measuredEnergyCount++
    }

    if (s.rejected) rejectedCount++

    // Label check
    const label = s.label?.toUpperCase()
    if (label === 'LIGHT' || label === 'NORMAL' || label === 'HEAVY') {
      classDist[label]++
    } else {
      missingCount++
    }

    const feat = (s as any).features || s
    const peakVoltage = feat.peakVoltage
    const averageVoltage = feat.averageVoltage
    const pulseDuration = feat.pulseDuration
    const stepInterval = feat.stepInterval
    const storageVoltage = feat.storageVoltage

    // Physical bounds and missing value check
    if (
      peakVoltage === undefined ||
      averageVoltage === undefined ||
      pulseDuration === undefined ||
      stepInterval === undefined ||
      storageVoltage === undefined
    ) {
      missingCount++
    } else {
      // Outlier bounds checks
      if (peakVoltage < 0 || peakVoltage > 50.0) outlierCount++
      if (averageVoltage < 0 || averageVoltage > peakVoltage * 1.05) outlierCount++
      if (pulseDuration < 5 || pulseDuration > 15000) outlierCount++
      if (stepInterval < 0 || stepInterval > 3600) outlierCount++
      if (storageVoltage < 0 || storageVoltage > 5.5) outlierCount++
    }
  }

  // Calculate Quality Score (0 to 100)
  let score = 100
  const missingRate = missingCount / total
  const outlierRate = outlierCount / total
  score -= Math.min(40, missingRate * 100)
  score -= Math.min(30, outlierRate * 100)

  // Class balance check
  const counts = Object.values(classDist)
  const minClass = Math.min(...counts)
  const maxClass = Math.max(...counts, 1)
  const balanceRatio = minClass / maxClass
  if (balanceRatio < 0.25) {
    score -= 15
  }

  // Participant diversity check
  if (participants.size < 2) {
    score -= 10
  }

  score = Math.max(0, Math.round(score))

  const recommendations: string[] = []
  const isReady = total >= 25 && minClass >= 5 && score >= 60

  if (total < 25) {
    recommendations.push(`Collect at least 25 samples (currently ${total}) for minimum training baseline.`)
  }
  if (minClass < 5) {
    recommendations.push('Each class (LIGHT, NORMAL, HEAVY) requires at least 5 ground-truth samples.')
  }
  if (participants.size < 2) {
    recommendations.push(
      'Label samples from at least 2 participants for subject-independent cross-validation.',
    )
  }
  if (outlierCount > 0) {
    recommendations.push(`${outlierCount} samples exhibited physical bounds violations or noise spikes.`)
  }
  if (measuredEnergyCount === 0) {
    recommendations.push('Current sensor not detected: energy models will operate in ESTIMATED mode.')
  }
  if (isReady && recommendations.length === 0) {
    recommendations.push('Dataset meets all academic and physical quality gates. Ready for model training.')
  }

  return {
    isValid: score >= 50,
    qualityScore: score,
    totalSamples: total,
    uniqueParticipants: participants.size,
    missingValuesCount: missingCount,
    outliersCount: outlierCount,
    rejectedCount,
    waveformAvailabilityPercent: Math.round((waveformCount / total) * 100),
    measuredEnergyAvailabilityPercent: Math.round((measuredEnergyCount / total) * 100),
    classDistribution: classDist,
    isReadyForTraining: isReady,
    recommendations,
  }
}

export async function createFrozenDatasetVersion(
  datasetVersion: string,
  featureVersion = 'features-v1',
  notes = '',
  userId?: string,
): Promise<IDatasetVersion> {
  const samples = await DatasetSample.find().lean()
  const quality = await validateDatasetQuality(samples as any)

  const versionDoc = await DatasetVersion.create({
    datasetVersion,
    sampleCount: quality.totalSamples,
    participantCount: quality.uniqueParticipants,
    featureVersion,
    classDistribution: quality.classDistribution,
    qualitySummary: {
      missingValuesCount: quality.missingValuesCount,
      outliersCount: quality.outliersCount,
      qualityScore: quality.qualityScore,
      rejectedCount: quality.rejectedCount,
      waveformAvailabilityPercent: quality.waveformAvailabilityPercent,
      measuredEnergyAvailabilityPercent: quality.measuredEnergyAvailabilityPercent,
    },
    isFrozen: true,
    notes,
    createdBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
  })

  return versionDoc
}

export async function listDatasetVersions(): Promise<IDatasetVersion[]> {
  return DatasetVersion.find().sort({ createdAt: -1 })
}
