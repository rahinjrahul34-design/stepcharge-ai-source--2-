import { config } from '../config/env.js'
import type { IStepFeatures } from '../models/Footstep.js'

export interface MlPredictionResponse {
  class: 'LIGHT' | 'NORMAL' | 'HEAVY'
  confidence: number
  probabilities: {
    LIGHT: number
    NORMAL: number
    HEAVY: number
  }
  contributions?: Record<string, number>
  modelVersion?: string
}

export type MlPredictionErrorCode = 'ML_SERVICE_UNAVAILABLE' | 'MODEL_NOT_TRAINED'

export interface MlPredictionResult {
  prediction: MlPredictionResponse | null
  errorCode?: MlPredictionErrorCode
}

export interface MlHealthResponse {
  reachable: boolean
  modelLoaded: boolean
  version: string | null
  error?: string
}

export interface MlModelMetadataResponse {
  modelName: string
  version: string
  datasetVersion?: string
  featureCount: number
  classes: string[]
  metrics?: {
    accuracy: number
    precision: number
    recall: number
    f1: number
  }
  confusionMatrix?: number[][]
  featureImportance?: Record<string, number>
  samples?: {
    total: number
    train: number
    test: number
  }
  labelDistribution?: Record<string, number>
  evaluationMethod?: string
  evaluationDetail?: string
  subjectIndependent?: boolean
  participants?: number
  warnings?: string[]
  trainedAt?: string
}

export async function checkMlHealth(): Promise<MlHealthResponse> {
  const url = `${config.mlServiceUrl}/health`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      return {
        reachable: false,
        modelLoaded: false,
        version: null,
        error: `HTTP ${res.status}: ${res.statusText}`,
      }
    }
    const data = (await res.json()) as any
    return {
      reachable: data.status === 'ok',
      modelLoaded: Boolean(data.modelLoaded),
      version: data.version || null,
    }
  } catch (error) {
    return {
      reachable: false,
      modelLoaded: false,
      version: null,
      error: error instanceof Error ? error.message : 'Connection failed',
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function predictFootstep(features: IStepFeatures): Promise<MlPredictionResult> {
  const url = `${config.mlServiceUrl}/predict`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 4000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      if (res.status === 503 && body.includes('MODEL_NOT_CONNECTED')) {
        return { prediction: null, errorCode: 'MODEL_NOT_TRAINED' }
      }
      console.warn(`[ML Service] Predict returned status ${res.status}`)
      return { prediction: null, errorCode: 'ML_SERVICE_UNAVAILABLE' }
    }

    const data = (await res.json()) as MlPredictionResponse
    return { prediction: data }
  } catch (error) {
    console.warn('[ML Service] Prediction request failed:', error instanceof Error ? error.message : error)
    return { prediction: null, errorCode: 'ML_SERVICE_UNAVAILABLE' }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function fetchMlModelMetadata(): Promise<MlModelMetadataResponse | null> {
  const url = `${config.mlServiceUrl}/model`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 4000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    return (await res.json()) as MlModelMetadataResponse
  } catch (error) {
    console.warn('[ML Service] Fetch model metadata failed:', error instanceof Error ? error.message : error)
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function trainMlModel(csv: string, version: string): Promise<any> {
  const url = `${config.mlServiceUrl}/train`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 min timeout for training

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv, version }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Training failed (${res.status}): ${errText}`)
    }

    return await res.json()
  } finally {
    clearTimeout(timeoutId)
  }
}
