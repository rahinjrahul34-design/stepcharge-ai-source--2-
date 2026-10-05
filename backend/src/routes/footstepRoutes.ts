import { Router } from 'express'
import { postFootstep } from '../controllers/footstepController.js'
import { requireDeviceAuth } from '../middlewares/deviceAuth.js'
import { telemetryLimiter } from '../middlewares/rateLimiter.js'

const router = Router({ mergeParams: true })

router.post('/', telemetryLimiter, requireDeviceAuth, postFootstep)

export default router
