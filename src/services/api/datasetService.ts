import type { DatasetSample, SourceMode, StepClass, StepFeatures } from '../../data/types'
import { deviceId, fetchApi } from './client'

const LS_KEY = 'stepcharge.dataset'

const readLocal = (): DatasetSample[] => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]') as DatasetSample[]
  } catch {
    return []
  }
}
const writeLocal = (rows: DatasetSample[]) => localStorage.setItem(LS_KEY, JSON.stringify(rows.slice(-5000)))

export function makeSample(
  features: StepFeatures,
  label: StepClass,
  mode: SourceMode,
  device: string,
  participantId?: string,
  note?: string,
): DatasetSample {
  return {
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    features,
    label,
    deviceId: device,
    source: mode,
    participantId: participantId?.trim() || undefined,
    note,
  }
}

export async function addSample(sample: DatasetSample): Promise<void> {
  const rows = readLocal()
  rows.push(sample)
  writeLocal(rows)

  if (sample.source === 'live') {
    try {
      await fetchApi('/dataset', {
        method: 'POST',
        body: JSON.stringify(sample),
      })
    } catch {
      /* local copy already saved; cloud sync is best-effort */
    }
  }
}

export async function listSamples(): Promise<DatasetSample[]> {
  const local = readLocal()
  try {
    const remote = await fetchApi<DatasetSample[]>(`/dataset?deviceId=${deviceId()}`)
    if (!remote || !remote.length) return local
    const seen = new Set(remote.map((r) => r.id))
    return [...remote, ...local.filter((l) => !seen.has(l.id))].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp),
    )
  } catch {
    return local
  }
}

export async function deleteSample(id: string): Promise<void> {
  writeLocal(readLocal().filter((r) => r.id !== id))
  try {
    await fetchApi(`/dataset/${id}`, {
      method: 'DELETE',
    })
  } catch {
    /* ignore — local delete already applied */
  }
}

export function datasetToCsv(rows: DatasetSample[]): string {
  const cols = [
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
  const body = rows.map((r) =>
    [
      r.id,
      r.timestamp,
      r.deviceId,
      r.participantId ?? '',
      r.features.peakVoltage,
      r.features.averageVoltage,
      r.features.pulseDuration,
      r.features.stepInterval,
      r.features.storageVoltage,
      r.label,
      r.source,
    ].join(','),
  )
  return [cols.join(','), ...body].join('\n')
}
