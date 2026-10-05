import { Router } from 'express'
import { getSystemHealth, getSelfTest, getSystemMonitor } from '../controllers/systemController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.get('/health', getSystemHealth)
router.get('/monitor', requireAuth, getSystemMonitor)
router.get('/self-test', requireAuth, getSelfTest)

export default router
