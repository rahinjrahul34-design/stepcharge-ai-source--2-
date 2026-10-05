import { Router } from 'express'
import {
  getHealth,
  getModelMetadata,
  predict,
  train,
} from '../controllers/mlController.js'
import { requireAuth, requireAdmin } from '../middlewares/auth.js'
import { mlPredictLimiter, mlTrainLimiter } from '../middlewares/rateLimiter.js'

const router = Router()

router.get('/health', getHealth)
router.get('/model', getModelMetadata)
router.post('/predict', mlPredictLimiter, predict)
router.post('/train', mlTrainLimiter, requireAuth, requireAdmin, train)

export default router
