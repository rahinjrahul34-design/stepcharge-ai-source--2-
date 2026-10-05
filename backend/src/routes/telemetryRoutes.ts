import { Router } from 'express'
import { postTelemetry, getLatest } from '../controllers/telemetryController.js'
import { requireDeviceAuth } from '../middlewares/deviceAuth.js'
import { requireAuth } from '../middlewares/auth.js'
import { requireDeviceAccess } from '../middlewares/deviceAccess.js'
import { telemetryLimiter } from '../middlewares/rateLimiter.js'

const router = Router({ mergeParams: true })

router.post('/', telemetryLimiter, requireDeviceAuth, postTelemetry)
router.get('/latest', requireAuth, requireDeviceAccess, getLatest)

export default router
