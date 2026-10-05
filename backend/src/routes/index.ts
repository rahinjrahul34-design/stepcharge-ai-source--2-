import { Router } from 'express'
import authRoutes from './authRoutes.js'
import deviceRoutes from './deviceRoutes.js'
import telemetryRoutes from './telemetryRoutes.js'
import footstepRoutes from './footstepRoutes.js'
import alertRoutes from './alertRoutes.js'
import historyRoutes from './historyRoutes.js'
import analyticsRoutes from './analyticsRoutes.js'
import datasetRoutes from './datasetRoutes.js'
import experimentRoutes from './experimentRoutes.js'
import mlRoutes from './mlRoutes.js'
import systemRoutes from './systemRoutes.js'
import aiRoutes from './aiRoutes.js'

import { getSystemHealth } from '../controllers/systemController.js'

const router = Router()

router.get('/health', getSystemHealth)
router.use('/auth', authRoutes)
router.use('/devices', deviceRoutes)
router.use('/devices/:deviceId/telemetry', telemetryRoutes)
router.use('/devices/:deviceId/footsteps', footstepRoutes)
router.use('/alerts', alertRoutes)
router.use('/history', historyRoutes)
router.use('/analytics', analyticsRoutes)
router.use('/dataset', datasetRoutes)
router.use('/experiments', experimentRoutes)
router.use('/ml', mlRoutes)
router.use('/ai', aiRoutes)
router.use('/system', systemRoutes)

export default router
