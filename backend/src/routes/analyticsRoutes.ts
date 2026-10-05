import { Router } from 'express'
import { getStats, getTrends } from '../controllers/analyticsController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.use(requireAuth)

router.get('/stats', getStats)
router.get('/devices/:deviceId/stats', getStats)
router.get('/trends', getTrends)
router.get('/devices/:deviceId/trends', getTrends)

export default router
