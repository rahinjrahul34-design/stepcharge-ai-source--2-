import type { DatasetSample, SourceMode, StepClass, StepFeatures } from '../../data/types'
import { deviceId, getDb, isFirebaseConfigured, paths } from './config'

/**
 * Dataset collection.
 *
 * Samples are ground truth: the operator performs a known footstep type and
 * labels the captured feature vector. They are therefore stored separately from
 * predictions and are NEVER auto-generated from model output — training on your
 * own predictions would be circular.
 *
 * Storage: Firebase (`dataset/samples/{deviceId}`) when configured, otherwise
 * localStorage so collection also works on a bench with no cloud access.
 * Demo-mode samples are tagged source:'demo' and excluded from live exports.
 */

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
  if (isFirebaseConfigured() && sample.source === 'live') {
    try {
      const db = await getDb()
      const { ref, set } = await import('firebase/database')
      await set(ref(db, `${paths.dataset(deviceId())}/${sample.id}`), sample)
    } catch {
      /* local copy already saved; cloud sync is best-effort */
    }
  }
}

export async function listSamples(): Promise<DatasetSample[]> {
  const local = readLocal()
  if (!isFirebaseConfigured()) return local
  try {
    const db = await getDb()
    const { ref, get } = await import('firebase/database')
    const snap = await get(ref(db, paths.dataset(deviceId())))
    if (!snap.exists()) return local
    const remote = Object.values(snap.val() as Record<string, DatasetSample>)
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
  if (!isFirebaseConfigured()) return
  try {
    const db = await getDb()
    const { ref, remove } = await import('firebase/database')
    await remove(ref(db, `${paths.dataset(deviceId())}/${id}`))
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
