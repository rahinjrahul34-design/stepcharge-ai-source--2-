import { Request, Response } from 'express'
import {
  checkMlHealth,
  fetchMlModelMetadata,
  predictFootstep,
  trainMlModel,
} from '../services/mlClientService.js'
import { ModelMetadataModel } from '../models/ModelMetadata.js'
import { AuditLog } from '../models/AuditLog.js'

export const MODEL_NOT_TRAINED = {
  modelName: 'MODEL NOT TRAINED',
  version: '—',
  trainedAt: null,
  featureCount: 5,
  datasetVersion: null,
  classes: ['LIGHT', 'NORMAL', 'HEAVY'],
  metrics: null,
  confusionMatrix: null,
  featureImportance: null,
  samples: null,
  labelDistribution: null,
  evaluationMethod: null,
  evaluationDetail: 'No model has been trained yet.',
  subjectIndependent: false,
  participants: 0,
  warnings: [],
}

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const health = await checkMlHealth()
  res.json({
    success: true,
    data: health,
  })
}

export async function getModelMetadata(_req: Request, res: Response): Promise<void> {
  // 1. Try to fetch live from ML microservice
  const remoteMeta = await fetchMlModelMetadata()
  if (remoteMeta && remoteMeta.modelName !== 'MODEL NOT TRAINED') {
    res.json({
      success: true,
      data: {
        ...remoteMeta,
        connected: true,
        source: 'api',
      },
    })
    return
  }

  // 2. Try to fetch latest trained metadata from MongoDB
  const dbMeta = await ModelMetadataModel.findOne({ isCurrent: true }).sort({ createdAt: -1 })
  if (dbMeta && dbMeta.metrics) {
    res.json({
      success: true,
      data: {
        modelName: dbMeta.modelName,
        version: dbMeta.version,
        datasetVersion: dbMeta.datasetVersion,
        featureCount: dbMeta.featureCount,
        classes: dbMeta.classes,
        metrics: dbMeta.metrics,
        confusionMatrix: dbMeta.confusionMatrix,
        featureImportance: dbMeta.featureImportance
          ? (dbMeta.featureImportance instanceof Map
              ? Object.fromEntries(dbMeta.featureImportance)
              : dbMeta.featureImportance)
          : null,
        samples: dbMeta.samples,
        labelDistribution: dbMeta.labelDistribution
          ? (dbMeta.labelDistribution instanceof Map
              ? Object.fromEntries(dbMeta.labelDistribution)
              : dbMeta.labelDistribution)
          : null,
        evaluationMethod: dbMeta.evaluationMethod,
        evaluationDetail: dbMeta.evaluationDetail,
        subjectIndependent: dbMeta.subjectIndependent,
        participants: dbMeta.participants,
        warnings: dbMeta.warnings,
        trainedAt: dbMeta.trainedAt,
        connected: true,
        source: 'mongodb',
      },
    })
    return
  }

  // 3. Fallback: MODEL NOT TRAINED
  res.json({
    success: true,
    data: {
      ...MODEL_NOT_TRAINED,
      connected: false,
      source: 'api',
    },
  })
}

export async function predict(req: Request, res: Response): Promise<void> {
  const { features } = req.body
  if (!features || typeof features !== 'object') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_FEATURES', message: 'Step features object is required.' },
    })
    return
  }

  const { peakVoltage, averageVoltage, pulseDuration, stepInterval, storageVoltage } = features
  const isFiniteNonNegative = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v) && !Number.isNaN(v) && v >= 0

  if (
    !isFiniteNonNegative(peakVoltage) ||
    peakVoltage > 60 ||
    !isFiniteNonNegative(averageVoltage) ||
    averageVoltage > 60 ||
    !isFiniteNonNegative(pulseDuration) ||
    pulseDuration > 60000 ||
    !isFiniteNonNegative(stepInterval) ||
    stepInterval > 3600 ||
    !isFiniteNonNegative(storageVoltage) ||
    storageVoltage > 60
  ) {
    res.status(400).json({
      success: false,
      error: {
        code: 'PHYSICAL_BOUNDS_ERROR',
        message: 'Features must be finite non-negative numbers within valid physical sensor bounds.',
      },
    })
    return
  }

  if (averageVoltage > peakVoltage * 1.05) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_VOLTAGE_RATIO',
        message: 'averageVoltage cannot exceed peakVoltage.',
      },
    })
    return
  }

  const { prediction, errorCode } = await predictFootstep(features)
  if (!prediction) {
    const isModelNotTrained = errorCode === 'MODEL_NOT_TRAINED'
    res.status(isModelNotTrained ? 409 : 503).json({
      success: false,
      error: {
        code: isModelNotTrained ? 'MODEL_NOT_TRAINED' : 'ML_SERVICE_UNAVAILABLE',
        message: isModelNotTrained
          ? 'ML service is running, but no trained model is currently available.'
          : 'ML service is unavailable.',
      },
    })
    return
  }

  res.json({
    success: true,
    data: prediction,
  })
}

export async function train(req: Request, res: Response): Promise<void> {
  const { csv, version } = req.body
  if (!csv || typeof csv !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_CSV', message: 'Raw CSV text is required for training.' },
    })
    return
  }

  try {
    const result = await trainMlModel(csv, version || 'v1.0')
    const meta = result.metadata

    if (meta) {
      // Store new model metadata in MongoDB
      await ModelMetadataModel.updateMany({}, { isCurrent: false })
      await ModelMetadataModel.create({
        modelName: meta.modelName || 'Random Forest (scikit-learn)',
        version: meta.version || version || 'v1.0',
        datasetVersion: meta.datasetVersion,
        featureCount: meta.featureCount || 5,
        classes: meta.classes || ['LIGHT', 'NORMAL', 'HEAVY'],
        metrics: meta.metrics,
        confusionMatrix: meta.confusionMatrix,
        featureImportance: meta.featureImportance,
        samples: meta.samples,
        labelDistribution: meta.labelDistribution,
        evaluationMethod: meta.evaluationMethod,
        evaluationDetail: meta.evaluationDetail,
        subjectIndependent: meta.subjectIndependent,
        participants: meta.participants,
        warnings: meta.warnings,
        trainedAt: new Date(),
        isCurrent: true,
      })

      await AuditLog.create({
        userId: req.user?.userId,
        userEmail: req.user?.email,
        action: 'TRAIN_ML_MODEL',
        resource: `Model:${meta.version}`,
        metadata: { metrics: meta.metrics },
        timestamp: new Date(),
      }).catch((err) => console.error('[Audit] Failed to log model training:', err))
    }

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'TRAINING_FAILED',
        message: error instanceof Error ? error.message : 'Model training failed.',
      },
    })
  }
}
