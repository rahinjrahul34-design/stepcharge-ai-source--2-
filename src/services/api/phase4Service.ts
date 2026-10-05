import { fetchApi, deviceId as getActiveDeviceId } from './client'
import type {
  ExperimentComparisonResult,
  StatisticalAnalysisResult,
  CorrelationMatrixResult,
  ResearchReportData,
  SystemMonitorData,
} from '../../data/types'

// -------------------------------------------------------------
// 1. Experiment Comparison & Statistical Analytics
// -------------------------------------------------------------

export async function compareExperimentSessions(
  sessionIds: string[],
): Promise<ExperimentComparisonResult> {
  return fetchApi<ExperimentComparisonResult>('/experiments/compare', {
    method: 'POST',
    body: JSON.stringify({ sessionIds }),
  })
}

export async function fetchStatisticalAnalysis(
  stepClass?: string,
  sessionId?: string,
): Promise<StatisticalAnalysisResult> {
  const params = new URLSearchParams()
  if (stepClass) params.append('stepClass', stepClass)
  if (sessionId) params.append('sessionId', sessionId)
  const query = params.toString() ? `?${params.toString()}` : ''
  return fetchApi<StatisticalAnalysisResult>(`/experiments/statistics${query}`)
}

export async function fetchCorrelationMatrix(
  sessionId?: string,
): Promise<CorrelationMatrixResult> {
  const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
  return fetchApi<CorrelationMatrixResult>(`/experiments/correlations${query}`)
}

export async function fetchResearchReport(
  sessionId?: string,
  deviceId = getActiveDeviceId(),
  format: 'json' | 'markdown' = 'json',
): Promise<ResearchReportData | string> {
  const params = new URLSearchParams()
  if (sessionId) params.append('sessionId', sessionId)
  if (deviceId) params.append('deviceId', deviceId)
  if (format) params.append('format', format)
  const query = params.toString() ? `?${params.toString()}` : ''

  if (format === 'markdown') {
    const res = await fetchApi<{ success: boolean; data: string }>(`/experiments/report${query}`)
    return (res as any)?.data || (res as any)
  }
  return fetchApi<ResearchReportData>(`/experiments/report${query}`)
}

// -------------------------------------------------------------
// 2. Production System Monitoring & Latency Breakdown
// -------------------------------------------------------------

export async function fetchSystemMonitor(
  deviceId = getActiveDeviceId(),
): Promise<SystemMonitorData> {
  const query = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ''
  return fetchApi<SystemMonitorData>(`/system/monitor${query}`)
}
