import { Router } from 'express'
import {
  register,
  getDevice,
  listDevices,
  rotateKey,
  setRevocation,
  getPiezoDiagnostics,
} from '../controllers/deviceController.js'
import { setCommand, reportActual, getLoads } from '../controllers/loadController.js'
import {
  getConfig,
  updateConfig,
  reportConfig,
} from '../controllers/deviceConfigController.js'
import {
  calibrateVoltageHandler,
  calibrateCurrentHandler,
  calibratePiezoHandler,
  getCalibrationLogsHandler,
} from '../controllers/calibrationController.js'
import {
  getWaveform,
  getLatestFootstepWaveform,
} from '../controllers/footstepController.js'
import { requireAuth, requireAdmin } from '../middlewares/auth.js'
import { requireDeviceAuth } from '../middlewares/deviceAuth.js'
import { requireDeviceAccess, requireDeviceOrOwnerAuth } from '../middlewares/deviceAccess.js'

const router = Router()

router.post('/', requireAuth, requireAdmin, register)
router.get('/', requireAuth, listDevices)
router.get('/:deviceId', requireAuth, requireDeviceAccess, getDevice)
router.post('/:deviceId/rotate-key', requireAuth, requireDeviceAccess, rotateKey)
router.post('/:deviceId/revoke', requireAuth, requireAdmin, setRevocation)
router.get('/:deviceId/piezo', requireAuth, requireDeviceAccess, getPiezoDiagnostics)

// Load control routes
router.get('/:deviceId/loads', requireDeviceOrOwnerAuth, getLoads)
router.post('/:deviceId/load-command', requireAuth, requireDeviceAccess, setCommand)
router.post('/:deviceId/load-state', requireDeviceAuth, reportActual)

// Remote Configuration routes (Phase 2)
router.get('/:deviceId/config', requireDeviceOrOwnerAuth, getConfig)
router.put('/:deviceId/config', requireAuth, requireDeviceAccess, updateConfig)
router.post('/:deviceId/config-status', requireDeviceAuth, reportConfig)

// Hardware Calibration routes (Phase 2)
router.post('/:deviceId/calibrate/voltage', requireAuth, requireDeviceAccess, calibrateVoltageHandler)
router.post('/:deviceId/calibrate/current', requireAuth, requireDeviceAccess, calibrateCurrentHandler)
router.post('/:deviceId/calibrate/piezo', requireAuth, requireDeviceAccess, calibratePiezoHandler)
router.get('/:deviceId/calibrate/logs', requireAuth, requireDeviceAccess, getCalibrationLogsHandler)

// Waveform retrieval routes (Phase 2)
router.get('/:deviceId/waveform/latest', requireAuth, requireDeviceAccess, getLatestFootstepWaveform)
router.get('/:deviceId/waveform/:footstepId', requireAuth, requireDeviceAccess, getWaveform)

export default router
