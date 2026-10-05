import { Router } from 'express'
import {
  createSessionHandler,
  listSessionsHandler,
  getSessionHandler,
  updateStatusHandler,
  getSamplesHandler,
  exportDataHandler,
  getDatasetQualityHandler,
  compareExperimentsHandler,
  getStatisticalAnalysisHandler,
  getCorrelationMatrixHandler,
  generateResearchReportHandler,
} from '../controllers/experimentController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.use(requireAuth)

router.post('/', createSessionHandler)
router.get('/', listSessionsHandler)
router.get('/quality', getDatasetQualityHandler)
router.post('/compare', compareExperimentsHandler)
router.get('/statistics', getStatisticalAnalysisHandler)
router.get('/correlations', getCorrelationMatrixHandler)
router.get('/report', generateResearchReportHandler)
router.get('/:sessionId', getSessionHandler)
router.patch('/:sessionId/status', updateStatusHandler)
router.get('/:sessionId/samples', getSamplesHandler)
router.get('/:sessionId/export', exportDataHandler)

export default router
