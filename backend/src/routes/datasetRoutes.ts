import { Router } from 'express'
import {
  addSample,
  listSamples,
  deleteSample,
  exportCsv,
} from '../controllers/datasetController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.use(requireAuth)

router.post('/', addSample)
router.get('/', listSamples)
router.delete('/:sampleId', deleteSample)
router.get('/export', exportCsv)

export default router
