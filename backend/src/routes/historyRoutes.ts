import { Router } from 'express'
import {
  queryFootstepHistory,
  queryTelemetryHistory,
} from '../controllers/historyController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.use(requireAuth)

router.get('/footsteps', queryFootstepHistory)
router.get('/devices/:deviceId/footsteps', queryFootstepHistory)
router.get('/telemetry', queryTelemetryHistory)
router.get('/devices/:deviceId/telemetry', queryTelemetryHistory)

export default router
