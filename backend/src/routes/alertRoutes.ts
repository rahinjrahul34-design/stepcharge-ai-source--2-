import { Router } from 'express'
import { getAlerts, resolve, createManualAlert, markRead, markAllRead } from '../controllers/alertController.js'
import { requireAuth, requireAdmin } from '../middlewares/auth.js'

const router = Router()

router.get('/', requireAuth, getAlerts)
router.post('/read-all', requireAuth, markAllRead)
router.post('/', requireAuth, requireAdmin, createManualAlert)
router.patch('/:alertId/read', requireAuth, markRead)
router.post('/:alertId/resolve', requireAuth, resolve)

export default router
