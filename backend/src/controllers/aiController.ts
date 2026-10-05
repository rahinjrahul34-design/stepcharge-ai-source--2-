import { Request, Response } from 'express'
import {
  listAllModels,
  getProductionModel,
  promoteModel,
  rollbackModel,
  archiveModel,
} from '../services/modelRegistryService.js'
import {
  getEnergyAnalytics,
  getPiezoHealth,
  getStorageIntelligence,
  getExplainableDeviceHealth,
} from '../services/aiIntelligenceService.js'
import {
  listAnomalies,
  resolveAnomaly,
} from '../services/aiAnomalyService.js'
import { generateAIInsights } from '../services/aiInsightsService.js'
import {
  validateDatasetQuality,
  createFrozenDatasetVersion,
  listDatasetVersions,
} from '../services/dataQualityService.js'
import { DatasetSample } from '../models/DatasetSample.js'
import { Footstep } from '../models/Footstep.js'

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000'

// --- Model Registry & Governance ---

export async function getModelRegistry(_req: Request, res: Response): Promise<void> {
  try {
    const models = await listAllModels()
    const activeProd = await getProductionModel()
    res.json({
      success: true,
      data: models,
      activeProductionModel: activeProd,
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } })
  }
}

export async function getProductionModelController(_req: Request, res: Response): Promise<void> {
  try {
    const activeProd = await getProductionModel()
    res.json({ success: true, data: activeProd })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } })
  }
}

export async function promoteModelController(req: Request, res: Response): Promise<void> {
  const version = req.params.version || req.body.version
  if (!version) {
    res.status(400).json({ success: false, error: { message: 'Model version is required.' } })
    return
  }
  try {
    const promoted = await promoteModel(version, req.user?.userId, req.user?.email)
    res.json({ success: true, data: promoted })
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message } })
  }
}

export async function rollbackModelController(req: Request, res: Response): Promise<void> {
  const version = req.params.version || req.body.targetVersion || req.body.version
  const reason = req.body.reason
  if (!version) {
    res.status(400).json({ success: false, error: { message: 'Target model version is required.' } })
    return
  }
  try {
    const rolledBack = await rollbackModel(version, reason || 'Administrative rollback', req.user?.userId, req.user?.email)
    res.json({ success: true, data: rolledBack })
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message } })
  }
}

export async function archiveModelController(req: Request, res: Response): Promise<void> {
  const version = req.params.version || req.body.version
  if (!version) {
    res.status(400).json({ success: false, error: { message: 'Model version is required.' } })
    return
  }
  try {
    const archived = await archiveModel(version)
    res.json({ success: true, data: archived })
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message } })
  }
}

// --- Multi-Model Comparison & Feature Study ---

export async function compareModelsController(req: Request, res: Response): Promise<void> {
  const { featureVersion } = req.body
  try {
    const samples = await DatasetSample.find().lean()
    if (samples.length < 20) {
      res.status(422).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_DATA',
          message: `At least 20 labelled dataset samples required for model comparison (found ${samples.length}).`,
        },
      })
      return
    }

    const response = await fetch(`${ML_SERVICE_URL}/compare-models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ samples, featureVersion: featureVersion || 'features-v1' }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      res.status(response.status).json({ success: false, error: err })
      return
    }

    const data = await response.json()
    res.json(data)
  } catch (error: any) {
    res.status(503).json({
      success: false,
      error: { code: 'ML_SERVICE_OFFLINE', message: 'Machine learning comparison service is offline.' },
    })
  }
}

export async function featureStudyController(_req: Request, res: Response): Promise<void> {
  try {
    const samples = await DatasetSample.find().lean()
    if (samples.length < 20) {
      res.status(422).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_DATA',
          message: `At least 20 dataset samples required for feature study (found ${samples.length}).`,
        },
      })
      return
    }

    const response = await fetch(`${ML_SERVICE_URL}/feature-study`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ samples }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      res.status(response.status).json({ success: false, error: err })
      return
    }

    const data = await response.json()
    res.json(data)
  } catch (error: any) {
    res.status(503).json({
      success: false,
      error: { code: 'ML_SERVICE_OFFLINE', message: 'Machine learning study service is offline.' },
    })
  }
}

// --- Energy Analytics & Forecasting ---

export async function getEnergyAnalyticsController(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId || (req.query.deviceId as string) || 'ESP32-01'
  const timeRange = (req.query.range as any) || 'day'
  try {
    const analytics = await getEnergyAnalytics(deviceId, timeRange)
    res.json({ success: true, data: analytics })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } })
  }
}

export async function forecastEnergyController(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId || (req.query.deviceId as string) || 'ESP32-01'
  try {
    const steps = await Footstep.find({ deviceId }).sort({ timestamp: -1 }).limit(100).lean()
    if (steps.length < 20) {
      res.json({
        success: true,
        data: {
          status: 'INSUFFICIENT_DATA',
          isAvailable: false,
          message: `At least 20 historical sequential steps required for energy forecasting (found ${steps.length}).`,
        },
      })
      return
    }

    const historicalData = steps.reverse()
    const response = await fetch(`${ML_SERVICE_URL}/forecast/energy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ historicalData }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      res.status(response.status).json({ success: false, error: err })
      return
    }

    const data = await response.json()
    res.json(data)
  } catch {
    res.json({
      success: true,
      data: {
        status: 'INSUFFICIENT_DATA',
        isAvailable: false,
        message: 'Forecasting service temporarily unreachable.',
      },
    })
  }
}

// --- Health, Anomalies & Insights ---

export async function getPiezoHealthController(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId || (req.query.deviceId as string) || 'ESP32-01'
  try {
    const health = await getPiezoHealth(deviceId)
    res.json({ success: true, data: health })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } })
  }
}

export async function getStorageIntelligenceController(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId || (req.query.deviceId as string) || 'ESP32-01'
  try {
    const storage = await getStorageIntelligence(deviceId)
    res.json({ success: true, data: storage })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } })
  }
}

export async function getExplainableHealthController(req: Request, res: Response): Promise<void> {
  const deviceId = req.params.deviceId || (req.query.deviceId as string) || 'ESP32-01'
  try {
    const health = await getExplainableDeviceHealth(deviceId)
    res.json({ success: true, data: health })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } })
  }
}

export async function getAnomaliesController(req: Request, res: Response): Promise<void> {
  const deviceId = req.query.deviceId as string
  try {
    const anomalies = await listAnomalies(deviceId, 50)
    res.json({ success: true, data: anomalies })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } })
  }
}

export async function resolveAnomalyController(req: Request, res: Response): Promise<void> {
  const anomalyId = req.params.anomalyId || req.params.id
  const status = req.body.status || 'RESOLVED'
  const notes = req.body.notes
  try {
    const resolved = await resolveAnomaly(anomalyId, req.user?.userId, status, notes)
    res.json({ success: true, data: resolved })
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message } })
  }
}

export async function getInsightsController(req: Request, res: Response): Promise<void> {
  const deviceId = req.query.deviceId as string
  try {
    const insights = await generateAIInsights(deviceId)
    res.json({ success: true, data: insights })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } })
  }
}

// --- Data Quality & Dataset Versioning ---

export async function getDatasetQualityController(_req: Request, res: Response): Promise<void> {
  try {
    const samples = await DatasetSample.find().lean()
    const quality = await validateDatasetQuality(samples as any)
    res.json({ success: true, data: quality })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } })
  }
}

export async function createDatasetVersionController(req: Request, res: Response): Promise<void> {
  const { datasetVersion, featureVersion, notes } = req.body
  if (!datasetVersion) {
    res.status(400).json({ success: false, error: { message: 'datasetVersion string is required.' } })
    return
  }
  try {
    const created = await createFrozenDatasetVersion(
      datasetVersion,
      featureVersion || 'features-v1',
      notes || '',
      req.user?.userId,
    )
    res.status(201).json({ success: true, data: created })
  } catch (error: any) {
    res.status(400).json({ success: false, error: { message: error.message } })
  }
}

export async function listDatasetVersionsController(_req: Request, res: Response): Promise<void> {
  try {
    const list = await listDatasetVersions()
    res.json({ success: true, data: list })
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } })
  }
}
