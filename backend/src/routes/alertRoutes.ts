import { Router } from 'express'
import { getAlerts, resolve, createManualAlert } from '../controllers/alertController.js'
import { requireAuth, requireAdmin } from '../middlewares/auth.js'

const router = Router()

router.get('/', requireAuth, getAlerts)
router.post('/', requireAuth, requireAdmin, createManualAlert)
router.post('/:alertId/resolve', requireAuth, resolve)

export default router
