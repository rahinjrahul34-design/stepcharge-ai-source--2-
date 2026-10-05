import { AnomalyEvent, IAnomalyEvent, AnomalyType, AnomalySeverity } from '../models/AnomalyEvent.js'
import mongoose from 'mongoose'

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000'

export async function detectAndRecordAnomaly(
  sample: {
    peakVoltage?: number
    averageVoltage?: number
    pulseDuration?: number
    stepInterval?: number
    storageVoltage?: number
    current?: number | null
    power?: number | null
  },
  deviceId: string,
): Promise<IAnomalyEvent | null> {
  const pv = sample.peakVoltage ?? 0.0
  const av = sample.averageVoltage ?? 0.0
  const dur = sample.pulseDuration ?? 0.0
  const sv = sample.storageVoltage ?? 0.0

  let isAnomaly = false
  let anomalyType: AnomalyType = 'VOLTAGE_SPIKE'
  let severity: AnomalySeverity = 'MEDIUM'
  let source: 'RULE-BASED' | 'ML-BASED' = 'RULE-BASED'
  let score: number | null = null
  let observedValue = ''
  let typicalRange = ''
  let possibleCause = ''

  // 1. Deterministic Physical Rules
  if (sv > 5.5) {
    isAnomaly = true
    anomalyType = 'STORAGE_ANOMALY'
    severity = 'CRITICAL'
    observedValue = `${sv.toFixed(2)} V`
    typicalRange = '1.00 V – 5.00 V'
    possibleCause = 'Supercapacitor terminal voltage exceeded safe rated maximum ceiling (5.5 V).'
    score = 1.0
  } else if (pv > 35.0) {
    isAnomaly = true
    anomalyType = 'VOLTAGE_SPIKE'
    severity = 'HIGH'
    observedValue = `${pv.toFixed(2)} V`
    typicalRange = '0.20 V – 25.00 V'
    possibleCause = 'Severe mechanical impact shock delivered to piezoelectric transducer.'
    score = 0.95
  } else if (dur > 5000.0) {
    isAnomaly = true
    anomalyType = 'UNUSUAL_PULSE'
    severity = 'MEDIUM'
    observedValue = `${dur.toFixed(0)} ms`
    typicalRange = '20 ms – 1500 ms'
    possibleCause = 'Extended mat compression or mechanical settling on harvest surface.'
    score = 0.8
  } else if (av > pv * 1.05 && pv > 0.1) {
    isAnomaly = true
    anomalyType = 'SENSOR_FAILURE'
    severity = 'HIGH'
    observedValue = `Average: ${av.toFixed(2)} V > Peak: ${pv.toFixed(2)} V`
    typicalRange = 'Average voltage <= Peak voltage'
    possibleCause = 'ADC acquisition timing fault or hardware channel corruption.'
    score = 0.9
  }

  // 2. Query ML Isolation Forest if no deterministic rule was violated
  if (!isAnomaly) {
    try {
      const res = await fetch(`${ML_SERVICE_URL}/anomalies/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample }),
      })
      if (res.ok) {
        const data = (await res.json()) as any
        const mlRes = data.data
        if (mlRes?.isAnomaly) {
          isAnomaly = true
          anomalyType = mlRes.anomalyType || 'VOLTAGE_SPIKE'
          severity = mlRes.severity || 'MEDIUM'
          source = 'ML-BASED'
          score = mlRes.anomalyScore
          observedValue = String(mlRes.observedValue || '')
          typicalRange = String(mlRes.typicalRange || '')
          possibleCause = String(mlRes.possibleCause || 'Unsupervised multivariate outlier detected.')
        }
      }
    } catch {
      // ML service offline — gracefully rely on rule-based anomaly detection
    }
  }

  if (!isAnomaly) return null

  const event = await AnomalyEvent.create({
    deviceId,
    timestamp: new Date(),
    anomalyType,
    severity,
    source,
    anomalyScore: score,
    status: 'ANOMALOUS',
    observedValue,
    typicalRange,
    possibleCause,
    evidence: sample,
    isResolved: false,
  })

  return event
}

export async function listAnomalies(
  deviceId?: string,
  limit = 50,
): Promise<IAnomalyEvent[]> {
  const query: any = {}
  if (deviceId) query.deviceId = deviceId
  return AnomalyEvent.find(query).sort({ timestamp: -1 }).limit(limit)
}

export async function resolveAnomaly(
  anomalyId: string,
  userId?: string,
  status: string = 'RESOLVED',
  notes?: string,
): Promise<IAnomalyEvent | null> {
  const event = await AnomalyEvent.findById(anomalyId)
  if (!event) return null

  event.isResolved = status === 'RESOLVED' || status === 'FALSE_POSITIVE'
  event.status = status as any
  event.resolvedAt = new Date()
  if (notes) (event as any).notes = notes
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    event.resolvedBy = new mongoose.Types.ObjectId(userId)
  }
  await event.save()
  return event
}
