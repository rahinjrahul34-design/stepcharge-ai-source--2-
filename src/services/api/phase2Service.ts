import { fetchApi, deviceId as getActiveDeviceId } from './client'
import type {
  DeviceRemoteConfig,
  CalibrationLog,
  ExperimentSession,
  DatasetQualityMetrics,
  SelfTestReport,
} from '../../data/types'

export interface DeviceConfigResponse {
  deviceId: string
  desired: DeviceRemoteConfig
  applied: {
    version: number
    status: 'SYNCHRONIZED' | 'PENDING' | 'REJECTED'
    appliedAt?: string
    rejectionReason?: string
  }
  syncStatus: 'SYNCHRONIZED' | 'PENDING' | 'REJECTED'
  isSynchronized: boolean
}

export async function fetchDeviceConfig(id = getActiveDeviceId()): Promise<DeviceConfigResponse> {
  return fetchApi<DeviceConfigResponse>(`/devices/${id}/config`)
}

export async function updateDeviceConfig(
  id = getActiveDeviceId(),
  updates: Partial<DeviceRemoteConfig>,
): Promise<DeviceConfigResponse> {
  return fetchApi<DeviceConfigResponse>(`/devices/${id}/config`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
}

export async function calibrateVoltage(
  id = getActiveDeviceId(),
  input: { referenceVoltage: number; measuredVoltage: number; apply: boolean },
) {
  return fetchApi<{
    referenceVoltage: number
    measuredVoltage: number
    previousScale: number
    newScale: number
    errorPercent: number
    applied: boolean
    status: string
  }>(`/devices/${id}/calibrate/voltage`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function calibrateCurrent(
  id = getActiveDeviceId(),
  input: { referenceCurrentMa: number; measuredCurrentMa: number; apply: boolean },
) {
  return fetchApi<{
    referenceCurrentMa: number
    measuredCurrentMa: number
    previousScale: number
    newScale: number
    errorPercent: number
    applied: boolean
    status: string
  }>(`/devices/${id}/calibrate/current`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function calibratePiezo(
  id = getActiveDeviceId(),
  input: { baselineNoiseV: number; lightStepPeakV: number; apply: boolean },
) {
  return fetchApi<{
    baselineNoiseV: number
    lightStepPeakV: number
    recommendedThreshold: number
    recommendedRelease: number
    applied: boolean
  }>(`/devices/${id}/calibrate/piezo`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function fetchCalibrationLogs(id = getActiveDeviceId()): Promise<CalibrationLog[]> {
  return fetchApi<CalibrationLog[]>(`/devices/${id}/calibrate/logs`)
}

export async function fetchLatestWaveform(id = getActiveDeviceId()): Promise<{
  waveform: number[]
  samplingRate: number
  peakVoltage: number
  averageVoltage: number
  pulseDuration: number
  timestamp: string
  stepClass: string
} | null> {
  return fetchApi<{
    waveform: number[]
    samplingRate: number
    peakVoltage: number
    averageVoltage: number
    pulseDuration: number
    timestamp: string
    stepClass: string
  } | null>(`/devices/${id}/waveform/latest`)
}

export async function listExperimentSessions(id?: string): Promise<ExperimentSession[]> {
  const query = id ? `?deviceId=${encodeURIComponent(id)}` : ''
  return fetchApi<ExperimentSession[]>(`/experiments${query}`)
}

export async function createExperimentSession(input: {
  experimentName: string
  participantId: string
  deviceId: string
  stepClass: string
  targetSteps: number
  notes?: string
}): Promise<ExperimentSession> {
  return fetchApi<ExperimentSession>('/experiments', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateExperimentStatus(
  sessionId: string,
  status: 'PLANNED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED',
): Promise<ExperimentSession> {
  return fetchApi<ExperimentSession>(`/experiments/${sessionId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function fetchExperimentSamples(sessionId: string): Promise<any[]> {
  return fetchApi<any[]>(`/experiments/${sessionId}/samples`)
}

export async function fetchDatasetQuality(): Promise<DatasetQualityMetrics> {
  return fetchApi<DatasetQualityMetrics>('/experiments/quality')
}

export async function runSystemSelfTest(id = getActiveDeviceId()): Promise<SelfTestReport> {
  const query = id ? `?deviceId=${encodeURIComponent(id)}` : ''
  return fetchApi<SelfTestReport>(`/system/self-test${query}`)
}
