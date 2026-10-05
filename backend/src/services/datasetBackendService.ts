import { DatasetSample, IDatasetSample } from '../models/DatasetSample.js'
import type { IStepFeatures } from '../models/Footstep.js'

export async function addDatasetSample(params: {
  sampleId?: string
  deviceId: string
  participantId?: string
  features: IStepFeatures
  label: 'LIGHT' | 'NORMAL' | 'HEAVY'
  source?: 'live' | 'demo'
  note?: string
  userId?: string
}): Promise<IDatasetSample> {
  const sampleId =
    params.sampleId || `s-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

  return DatasetSample.create({
    sampleId,
    deviceId: params.deviceId,
    participantId: params.participantId?.trim() || undefined,
    timestamp: new Date(),
    features: params.features,
    label: params.label,
    source: params.source || 'live',
    note: params.note,
    createdBy: params.userId,
  })
}

export async function listDatasetSamples(deviceId?: string): Promise<IDatasetSample[]> {
  const filter: Record<string, unknown> = {}
  if (deviceId) filter.deviceId = deviceId
  return DatasetSample.find(filter).sort({ timestamp: 1 })
}

export async function deleteDatasetSample(sampleId: string): Promise<boolean> {
  const res = await DatasetSample.deleteOne({ sampleId })
  return res.deletedCount > 0
}

export function exportDatasetToCsv(samples: IDatasetSample[]): string {
  const headers = [
    'id',
    'timestamp',
    'deviceId',
    'participantId',
    'peakVoltage',
    'averageVoltage',
    'pulseDuration',
    'stepInterval',
    'storageVoltage',
    'label',
    'source',
  ]

  const rows = samples.map((s) => [
    s.sampleId,
    s.timestamp.toISOString(),
    s.deviceId,
    s.participantId || '',
    s.features.peakVoltage,
    s.features.averageVoltage,
    s.features.pulseDuration,
    s.features.stepInterval,
    s.features.storageVoltage,
    s.label,
    s.source,
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}
