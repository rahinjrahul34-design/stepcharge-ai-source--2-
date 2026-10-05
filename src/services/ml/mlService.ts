import type { ModelMetadata, Prediction, StepClass, StepFeatures } from '../../data/types'

/**
 * ML service abstraction.
 *
 * Two implementations share one interface:
 *  • DemoClassifier  — a transparent rule/distance heuristic. Its output is
 *                      ALWAYS tagged "DEMO PREDICTION". It is not a trained model
 *                      and the UI must never present it as one.
 *  • RemoteModel     — POSTs the 5-feature vector to a Python/scikit-learn API
 *                      (VITE_ML_API_URL). Output is tagged "ML PREDICTION" and
 *                      metrics/importances come from the server, never invented here.
 *
 * Expected API contract (FastAPI/Flask example):
 *   POST {base}/predict  { features: {...} }
 *     → { class, confidence, probabilities:{LIGHT,NORMAL,HEAVY},
 *         contributions?:{...}, modelVersion? }
 *   GET  {base}/model
 *     → { modelName, version, trainedAt, featureCount, datasetVersion, classes,
 *         metrics:{accuracy,precision,recall,f1}, confusionMatrix,
 *         featureImportance, samples:{total,train,test}, labelDistribution }
 */

export interface MlHealth {
  reachable: boolean
  modelLoaded: boolean
  version: string | null
  error?: string
}

export interface MlService {
  readonly kind: 'demo' | 'api'
  readonly baseUrl: string | null
  predictStep(features: StepFeatures): Promise<Prediction>
  getMetadata(): Promise<ModelMetadata>
  health(): Promise<MlHealth>
  /** Trains from dashboard-collected CSV. Only the API implementation supports it. */
  train(csv: string, version: string): Promise<ModelMetadata>
}

const CLASSES: StepClass[] = ['LIGHT', 'NORMAL', 'HEAVY']

const softmax = (logits: number[]): number[] => {
  const m = Math.max(...logits)
  const e = logits.map((l) => Math.exp(l - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / s)
}

/* ------------------------------------------------------------------ *
 * Demo classifier — deterministic, explainable, honestly labelled.
 * ------------------------------------------------------------------ */
export class DemoClassifier implements MlService {
  readonly kind = 'demo' as const
  readonly baseUrl = null

  /** Class centroids in feature space (peakV, pulseMs, intervalS). */
  private readonly centroids: Record<StepClass, [number, number, number]> = {
    LIGHT: [1.7, 120, 1.1],
    NORMAL: [3.3, 190, 1.8],
    HEAVY: [4.8, 270, 2.3],
  }

  async predictStep(f: StepFeatures): Promise<Prediction> {
    const logits = CLASSES.map((c) => {
      const [pv, pd, si] = this.centroids[c]
      const d =
        Math.abs(f.peakVoltage - pv) * 1.7 +
        (Math.abs(f.pulseDuration - pd) / 100) * 1.0 +
        Math.abs(f.stepInterval - si) * 0.35
      return 3.4 - d
    })
    const p = softmax(logits)
    const probabilities = {
      LIGHT: p[0],
      NORMAL: p[1],
      HEAVY: p[2],
    } as Record<StepClass, number>
    const cls = CLASSES[p.indexOf(Math.max(...p))]

    // Heuristic "contribution" = how much each feature separated the winner from
    // the runner-up. Clearly a heuristic, surfaced as such by prediction_source.
    const sorted = [...p].sort((a, b) => b - a)
    const margin = Math.max(0.05, sorted[0] - sorted[1])
    const [pv, pd, si] = this.centroids[cls]
    const raw = {
      peakVoltage: 1 / (1 + Math.abs(f.peakVoltage - pv)),
      pulseDuration: 1 / (1 + Math.abs(f.pulseDuration - pd) / 100),
      stepInterval: 1 / (1 + Math.abs(f.stepInterval - si)),
      averageVoltage: 1 / (1 + Math.abs(f.averageVoltage - pv * 0.65)),
      storageVoltage: 0.25,
    }
    const tot = Object.values(raw).reduce((a, b) => a + b, 0)
    const contributions = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, (v / tot) * (0.6 + margin * 0.4)]),
    ) as Record<keyof StepFeatures, number>

    return {
      class: cls,
      confidence: probabilities[cls],
      probabilities,
      source: 'DEMO PREDICTION',
      contributions,
      modelVersion: 'heuristic-demo-1.0',
    }
  }

  async getMetadata(): Promise<ModelMetadata> {
    // A heuristic has no trained metrics. Report none rather than inventing any.
    return {
      connected: false,
      source: 'demo',
      modelName: 'Demo heuristic classifier (not a trained model)',
      version: 'heuristic-demo-1.0',
      trainedAt: null,
      featureCount: 5,
      datasetVersion: null,
      classes: CLASSES,
      metrics: null,
      confusionMatrix: null,
      featureImportance: null,
      samples: null,
      labelDistribution: null,
      evaluationMethod: null,
      evaluationDetail: 'No model is trained, so nothing has been evaluated.',
      subjectIndependent: false,
      participants: 0,
      warnings: [],
    }
  }

  async health(): Promise<MlHealth> {
    // The heuristic always "runs", but it is not a model: modelLoaded is false.
    return { reachable: true, modelLoaded: false, version: 'heuristic-demo-1.0' }
  }

  async train(): Promise<ModelMetadata> {
    throw new Error(
      'Training requires the Python ML service. Set VITE_ML_API_URL to a running scikit-learn API.',
    )
  }
}

/* ------------------------------------------------------------------ *
 * Remote scikit-learn model
 * ------------------------------------------------------------------ */
export class RemoteModel implements MlService {
  readonly kind = 'api' as const
  readonly baseUrl: string
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async json<T>(path: string, init?: RequestInit, timeoutMs = 6000): Promise<T> {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`ML API ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`)
      }
      return (await res.json()) as T
    } finally {
      clearTimeout(t)
    }
  }

  async predictStep(features: StepFeatures): Promise<Prediction> {
    const r = await this.json<Omit<Prediction, 'source'>>('/predict', {
      method: 'POST',
      body: JSON.stringify({ features }),
    })
    return { ...r, source: 'ML PREDICTION' }
  }

  async getMetadata(): Promise<ModelMetadata> {
    const r = await this.json<Omit<ModelMetadata, 'connected' | 'source'>>('/model')
    return { ...r, connected: true, source: 'api' }
  }

  async health(): Promise<MlHealth> {
    try {
      const r = await this.json<{ status: string; modelLoaded: boolean; version: string | null }>(
        '/health',
        undefined,
        3000,
      )
      return { reachable: r.status === 'ok', modelLoaded: Boolean(r.modelLoaded), version: r.version }
    } catch (e) {
      return { reachable: false, modelLoaded: false, version: null, error: (e as Error).message }
    }
  }

  /** POST /train — returns the REAL metrics computed on the held-out split. */
  async train(csv: string, version: string): Promise<ModelMetadata> {
    const r = await this.json<{ metadata: Omit<ModelMetadata, 'connected' | 'source'> }>(
      '/train',
      { method: 'POST', body: JSON.stringify({ csv, version }) },
      120_000,
    )
    return { ...r.metadata, connected: true, source: 'api' }
  }
}

export const ML_API_URL = (import.meta.env.VITE_ML_API_URL as string | undefined)?.replace(/\/$/, '')

/** Returns the remote model when configured, otherwise the clearly-labelled demo heuristic. */
export function createMlService(): MlService {
  return ML_API_URL ? new RemoteModel(ML_API_URL) : new DemoClassifier()
}

export const MODEL_NOT_CONNECTED: ModelMetadata = {
  connected: false,
  source: 'demo',
  modelName: 'MODEL NOT CONNECTED',
  version: '—',
  trainedAt: null,
  featureCount: 5,
  datasetVersion: null,
  classes: CLASSES,
  metrics: null,
  confusionMatrix: null,
  featureImportance: null,
  samples: null,
  labelDistribution: null,
}
