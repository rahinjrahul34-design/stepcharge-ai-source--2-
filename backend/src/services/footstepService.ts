import { Footstep, IFootstep, IStepFeatures } from '../models/Footstep.js'
import { ExperimentSession } from '../models/ExperimentSession.js'
import { DatasetSample } from '../models/DatasetSample.js'
import { predictFootstep } from './mlClientService.js'
import { emitFootstepDetected } from '../config/socket.js'
import { randomUUID } from 'crypto'

export const R_EQ_OHMS = 10000

export function calculateStepEnergy(avgVolts: number, pulseMs: number, rEq = R_EQ_OHMS): number {
  if (avgVolts <= 0 || pulseMs <= 0) return 0
  return ((avgVolts * avgVolts) / rEq) * (pulseMs / 1000)
}

export interface FootstepInput {
  deviceId: string
  timestamp?: string
  sequenceNumber?: number | null
  peakVoltage: number
  averageVoltage: number
  pulseDuration: number
  stepInterval: number
  storageVoltage: number
  waveform?: number[]
  samplingRate?: number
  current?: number | null
  power?: number | null
  measuredEnergyJ?: number | null
  stepClass?: 'LIGHT' | 'NORMAL' | 'HEAVY'
  confidence?: number | null
}

export async function recordFootstep(input: FootstepInput): Promise<IFootstep> {
  const timestamp = input.timestamp ? new Date(input.timestamp) : new Date()

  const features: IStepFeatures = {
    peakVoltage: input.peakVoltage,
    averageVoltage: input.averageVoltage,
    pulseDuration: input.pulseDuration,
    stepInterval: input.stepInterval,
    storageVoltage: input.storageVoltage,
  }

  let finalClass: 'LIGHT' | 'NORMAL' | 'HEAVY' | 'UNKNOWN' = input.stepClass || 'UNKNOWN'
  let finalConfidence: number | null = typeof input.confidence === 'number' ? input.confidence : null
  let predictionSource: 'ML PREDICTION' | 'DEVICE PREDICTION' | 'UNCLASSIFIED' =
    input.stepClass ? 'DEVICE PREDICTION' : 'UNCLASSIFIED'
  let probabilities: { LIGHT: number; NORMAL: number; HEAVY: number } = {
    LIGHT: 0,
    NORMAL: 0,
    HEAVY: 0,
  }
  let modelVersion: string | null = null

  // If no on-device classification was supplied, consult Python ML Service
  if (predictionSource === 'UNCLASSIFIED') {
    const mlResult = await predictFootstep(features)
    if (mlResult.prediction) {
      finalClass = mlResult.prediction.class
      finalConfidence = mlResult.prediction.confidence
      probabilities = mlResult.prediction.probabilities
      modelVersion = mlResult.prediction.modelVersion || 'v1.0'
      predictionSource = 'ML PREDICTION'
    }
  }

  const estimatedEnergyJ = calculateStepEnergy(input.averageVoltage, input.pulseDuration)

  const footstep = await Footstep.create({
    deviceId: input.deviceId,
    timestamp,
    sequenceNumber: input.sequenceNumber ?? null,
    features,
    waveform: Array.isArray(input.waveform) ? input.waveform : [],
    samplingRate: input.samplingRate || 50,
    current: input.current ?? null,
    power: input.power ?? null,
    measuredEnergyJ: input.measuredEnergyJ ?? null,
    stepClass: finalClass,
    confidence: finalConfidence,
    probabilities,
    predictionSource,
    estimatedEnergyJ,
    measurementQuality: 'VALID',
    energyProvenance: {
      method: input.measuredEnergyJ != null ? 'MEASURED_POWER_INTEGRAL' : 'STEP_ESTIMATE',
      quality: 'VALID',
    },
    featureVersion: 'features-v1',
    modelVersion,
  })

  // ---------------- Experiment Mode Auto-Capture Hook ----------------
  // If an active academic experiment is running on this device, automatically capture sample
  try {
    const activeSession = await ExperimentSession.findOne({
      deviceId: input.deviceId,
      status: 'RUNNING',
    })

    if (activeSession) {
      // Validate sample quality before accepting into academic dataset
      const isValid =
        input.peakVoltage >= 0.2 &&
        input.pulseDuration >= 30 &&
        input.pulseDuration <= 4000

      await DatasetSample.create({
        sampleId: `exp_${activeSession.sessionId}_${randomUUID().slice(0, 8)}`,
        deviceId: input.deviceId,
        participantId: activeSession.participantId,
        sessionId: activeSession.sessionId,
        sequenceNumber: input.sequenceNumber ?? undefined,
        timestamp,
        features,
        waveform: footstep.waveform,
        measuredEnergyJ: input.measuredEnergyJ ?? null,
        measurementQuality: isValid ? 'VALID' : 'REJECTED_OUT_OF_BOUNDS',
        featureVersion: 'features-v1',
        modelVersion,
        label: activeSession.stepClass, // Ground-truth label defined by experiment operator
        rejected: !isValid,
        rejectionReason: !isValid ? 'Step signal out of physical bounds' : null,
        source: 'live',
        note: `Captured in experiment ${activeSession.experimentName} (Participant ${activeSession.participantId})`,
        createdBy: activeSession.createdBy,
      })

      activeSession.collectedSteps += 1
      if (isValid) {
        activeSession.validSteps += 1
      } else {
        activeSession.rejectedSteps += 1
      }

      if (activeSession.collectedSteps >= activeSession.targetSteps) {
        activeSession.status = 'COMPLETED'
        activeSession.completedAt = new Date()
      }
      await activeSession.save()
    }
  } catch (err) {
    console.error('[Footstep] Experiment auto-capture error:', err)
  }

  // Format wire payload for React frontend
  const wireEvent = {
    id: footstep._id.toString(),
    timestamp: footstep.timestamp.toISOString(),
    device_id: footstep.deviceId,
    sequence_number: footstep.sequenceNumber,
    features: {
      peakVoltage: footstep.features.peakVoltage,
      averageVoltage: footstep.features.averageVoltage,
      pulseDuration: footstep.features.pulseDuration,
      stepInterval: footstep.features.stepInterval,
      storageVoltage: footstep.features.storageVoltage,
    },
    waveform: footstep.waveform,
    sampling_rate: footstep.samplingRate,
    current_a: footstep.current,
    power_w: footstep.power,
    measured_energy_j: footstep.measuredEnergyJ,
    step_class: footstep.stepClass,
    confidence: footstep.confidence,
    probabilities: footstep.probabilities,
    prediction_source: footstep.predictionSource,
    peak_voltage: footstep.features.peakVoltage,
    pulse_duration_ms: footstep.features.pulseDuration,
    step_interval_ms: Math.round((footstep.features.stepInterval ?? 0) * 1000),
    storage_voltage: footstep.features.storageVoltage,
    estimated_energy_j: footstep.estimatedEnergyJ,
    feature_version: footstep.featureVersion,
    model_version: footstep.modelVersion,
    source: 'live',
  }

  emitFootstepDetected(footstep.deviceId, wireEvent)

  return footstep
}

export async function getLatestWaveform(deviceId: string): Promise<{
  waveform: number[]
  samplingRate: number
  peakVoltage: number
  averageVoltage: number
  pulseDuration: number
  timestamp: string
  stepClass: string
} | null> {
  const latest = await Footstep.findOne({
    deviceId,
    'waveform.0': { $exists: true },
  }).sort({ timestamp: -1 })

  if (!latest || !latest.waveform || latest.waveform.length === 0) {
    return null
  }

  return {
    waveform: latest.waveform,
    samplingRate: latest.samplingRate || 50,
    peakVoltage: latest.features.peakVoltage,
    averageVoltage: latest.features.averageVoltage,
    pulseDuration: latest.features.pulseDuration,
    timestamp: latest.timestamp.toISOString(),
    stepClass: latest.stepClass,
  }
}
