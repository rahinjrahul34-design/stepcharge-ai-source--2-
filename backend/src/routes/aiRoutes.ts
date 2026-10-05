import { Router } from 'express'
import {
  getModelRegistry,
  getProductionModelController,
  promoteModelController,
  rollbackModelController,
  archiveModelController,
  compareModelsController,
  featureStudyController,
  getEnergyAnalyticsController,
  forecastEnergyController,
  getPiezoHealthController,
  getStorageIntelligenceController,
  getExplainableHealthController,
  getAnomaliesController,
  resolveAnomalyController,
  getInsightsController,
  getDatasetQualityController,
  createDatasetVersionController,
  listDatasetVersionsController,
} from '../controllers/aiController.js'
import { requireAuth, requireAdmin } from '../middlewares/auth.js'

const router = Router()

// All AI intelligence routes require user authentication
router.use(requireAuth)

// Model Registry & Governance (Supports both /models and /registry paths)
router.get('/registry', getModelRegistry)
router.get('/models', getModelRegistry)
router.get('/models/production', getProductionModelController)
router.post('/registry/:version/promote', requireAdmin, promoteModelController)
router.post('/registry/:version/rollback', requireAdmin, rollbackModelController)
router.post('/registry/:version/archive', requireAdmin, archiveModelController)
router.post('/models/promote', requireAdmin, promoteModelController)
router.post('/models/rollback', requireAdmin, rollbackModelController)
router.post('/models/archive', requireAdmin, archiveModelController)

// Comparative Machine Learning & Feature Ablation
router.post('/compare-models', compareModelsController)
router.post('/feature-study', featureStudyController)

// Energy Analytics & Forecasting
router.get('/energy-analytics', getEnergyAnalyticsController)
router.get('/energy-analytics/:deviceId', getEnergyAnalyticsController)
router.get('/analytics/energy', getEnergyAnalyticsController)
router.get('/forecast', forecastEnergyController)
router.get('/forecast/energy', forecastEnergyController)

// Device Health & Component Diagnostics
router.get('/piezo-health', getPiezoHealthController)
router.get('/analytics/piezo', getPiezoHealthController)
router.get('/storage-intelligence', getStorageIntelligenceController)
router.get('/analytics/storage', getStorageIntelligenceController)
router.get('/explainable-health', getExplainableHealthController)
router.get('/analytics/health', getExplainableHealthController)

// Anomaly Detection & Insights
router.get('/anomalies', getAnomaliesController)
router.patch('/anomalies/:anomalyId/resolve', resolveAnomalyController)
router.post('/anomalies/:id/resolve', resolveAnomalyController)
router.get('/insights', getInsightsController)

// Data Quality & Dataset Versioning
router.get('/quality', getDatasetQualityController)
router.get('/datasets/versions', listDatasetVersionsController)
router.post('/datasets/versions', requireAdmin, createDatasetVersionController)
router.post('/datasets/freeze', requireAdmin, createDatasetVersionController)

export default router
