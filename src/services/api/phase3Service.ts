import { fetchApi, deviceId as getActiveDeviceId } from './client'
import type {
  ModelRegistryItem,
  ModelComparisonResult,
  FeatureStudyResult,
  AnomalyEventRecord,
  EnergyForecastResult,
  EnergyAnalyticsResult,
  ExplainableHealthData,
  DatasetVersionRecord,
} from '../../data/types'

// -------------------------------------------------------------
// 1. Model Registry & Lifecycle Management
// -------------------------------------------------------------

export async function fetchModelRegistry(): Promise<ModelRegistryItem[]> {
  return fetchApi<ModelRegistryItem[]>('/ai/models')
}

export async function fetchProductionModel(): Promise<ModelRegistryItem> {
  return fetchApi<ModelRegistryItem>('/ai/models/production')
}

export async function promoteModel(version: string): Promise<ModelRegistryItem> {
  return fetchApi<ModelRegistryItem>('/ai/models/promote', {
    method: 'POST',
    body: JSON.stringify({ version }),
  })
}

export async function rollbackModel(
  targetVersion: string,
  reason: string,
): Promise<ModelRegistryItem> {
  return fetchApi<ModelRegistryItem>('/ai/models/rollback', {
    method: 'POST',
    body: JSON.stringify({ targetVersion, reason }),
  })
}

export async function archiveModel(version: string): Promise<ModelRegistryItem> {
  return fetchApi<ModelRegistryItem>('/ai/models/archive', {
    method: 'POST',
    body: JSON.stringify({ version }),
  })
}

// -------------------------------------------------------------
// 2. Multi-Model Benchmark & Feature Ablation Study
// -------------------------------------------------------------

export async function compareModels(
  datasetVersion?: string,
  crossValidation = 'GroupKFold (Subject-Independent)',
): Promise<ModelComparisonResult> {
  return fetchApi<ModelComparisonResult>('/ai/compare-models', {
    method: 'POST',
    body: JSON.stringify({ datasetVersion, crossValidation }),
  })
}

export async function runFeatureStudy(
  datasetVersion?: string,
): Promise<FeatureStudyResult> {
  return fetchApi<FeatureStudyResult>('/ai/feature-study', {
    method: 'POST',
    body: JSON.stringify({ datasetVersion }),
  })
}

// -------------------------------------------------------------
// 3. Dataset Versioning & Quality
// -------------------------------------------------------------

export async function fetchDatasetVersions(): Promise<DatasetVersionRecord[]> {
  return fetchApi<DatasetVersionRecord[]>('/ai/datasets/versions')
}

export async function freezeDatasetVersion(
  version: string,
  note?: string,
  isBaseline?: boolean,
): Promise<DatasetVersionRecord> {
  return fetchApi<DatasetVersionRecord>('/ai/datasets/freeze', {
    method: 'POST',
    body: JSON.stringify({ version, note, isBaseline }),
  })
}

// -------------------------------------------------------------
// 4. Anomaly Detection & Triage
// -------------------------------------------------------------

export async function fetchAnomalies(options?: {
  deviceId?: string
  severity?: string
  status?: string
  limit?: number
}): Promise<AnomalyEventRecord[]> {
  const params = new URLSearchParams()
  if (options?.deviceId) params.append('deviceId', options.deviceId)
  if (options?.severity) params.append('severity', options.severity)
  if (options?.status) params.append('status', options.status)
  if (options?.limit) params.append('limit', options.limit.toString())

  const queryString = params.toString() ? `?${params.toString()}` : ''
  return fetchApi<AnomalyEventRecord[]>(`/ai/anomalies${queryString}`)
}

export async function resolveAnomaly(
  id: string,
  status: 'RESOLVED' | 'ACKNOWLEDGED' | 'FALSE_POSITIVE',
  notes?: string,
): Promise<AnomalyEventRecord> {
  return fetchApi<AnomalyEventRecord>(`/ai/anomalies/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ status, notes }),
  })
}

// -------------------------------------------------------------
// 5. Energy Forecasting & Intelligence Analytics
// -------------------------------------------------------------

export async function fetchEnergyForecast(
  deviceId = getActiveDeviceId(),
  horizon = 'next_100_steps',
  stepsAhead = 50,
): Promise<EnergyForecastResult> {
  return fetchApi<EnergyForecastResult>(
    `/ai/forecast/energy?deviceId=${encodeURIComponent(deviceId)}&horizon=${horizon}&stepsAhead=${stepsAhead}`,
  )
}

export async function fetchEnergyAnalytics(
  deviceId = getActiveDeviceId(),
  timeRange = 'day',
): Promise<EnergyAnalyticsResult> {
  return fetchApi<EnergyAnalyticsResult>(
    `/ai/analytics/energy?deviceId=${encodeURIComponent(deviceId)}&timeRange=${timeRange}`,
  )
}

export async function fetchPiezoHealth(deviceId = getActiveDeviceId()) {
  return fetchApi<{
    status: string
    baselineNoiseFloorV: number
    recentBaselineNoiseV: number
    baselineDriftPercent: number
    signalConsistencyScore: number
    eventDetectionRatePerMin: number
    recommendation: string
  }>(`/ai/analytics/piezo?deviceId=${encodeURIComponent(deviceId)}`)
}

export async function fetchStorageIntelligence(deviceId = getActiveDeviceId()) {
  return fetchApi<{
    currentVoltage: number
    minVoltage: number
    maxVoltage: number
    supercapFarads: number
    estimatedStoredEnergyJ: number
    chargeTrend: string
    voltageSaturationPercent: number
    alertState: string
  }>(`/ai/analytics/storage?deviceId=${encodeURIComponent(deviceId)}`)
}

export async function fetchExplainableDeviceHealth(
  deviceId = getActiveDeviceId(),
): Promise<ExplainableHealthData> {
  return fetchApi<ExplainableHealthData>(
    `/ai/analytics/health?deviceId=${encodeURIComponent(deviceId)}`,
  )
}

export async function fetchAIInsights(deviceId = getActiveDeviceId()) {
  return fetchApi<
    Array<{
      _id: string
      insightType: string
      title: string
      summary: string
      evidence: string
      confidence: number
      sourceDataRange: string
      algorithmVersion: string
      category: string
      createdAt: string
    }>
  >(`/ai/insights?deviceId=${encodeURIComponent(deviceId)}`)
}
