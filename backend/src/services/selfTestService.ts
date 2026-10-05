import { Device } from '../models/Device.js'
import { Telemetry } from '../models/Telemetry.js'
import { isDbConnected } from '../config/database.js'
import { checkMlHealth } from './mlClientService.js'

export type SelfTestStatus = 'PASS' | 'FAIL' | 'NOT_INSTALLED' | 'NOT_TESTABLE' | 'WARNING'

export interface ComponentTestResult {
  component: string
  status: SelfTestStatus
  details: string
  timestamp: string
}

export async function runSystemSelfTest(deviceId?: string): Promise<{
  timestamp: string
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
  results: ComponentTestResult[]
}> {
  const now = new Date()
  const results: ComponentTestResult[] = []

  // 1. Database Persistence Check
  const dbOk = isDbConnected()
  results.push({
    component: 'MongoDB Persistence',
    status: dbOk ? 'PASS' : 'FAIL',
    details: dbOk ? 'MongoDB Atlas connection active and healthy.' : 'Database connection unavailable.',
    timestamp: now.toISOString(),
  })

  // 2. Python ML Microservice Health
  const mlHealth = await checkMlHealth()
  results.push({
    component: 'Machine Learning Service',
    status: mlHealth.reachable ? 'PASS' : 'FAIL',
    details: mlHealth.reachable
      ? `FastAPI service responding (Version: ${mlHealth.version || 'v1.0'}, Model Loaded: ${mlHealth.modelLoaded}).`
      : `ML service offline (${mlHealth.error || 'Connection refused'}).`,
    timestamp: now.toISOString(),
  })

  // Device-specific checks
  let targetDevice = null
  if (deviceId) {
    targetDevice = await Device.findOne({ deviceId: deviceId.trim() })
  } else {
    targetDevice = await Device.findOne().sort({ lastSeenAt: -1 })
  }

  if (!targetDevice) {
    results.push({
      component: 'ESP32 Hardware Controller',
      status: 'NOT_TESTABLE',
      details: 'No registered hardware device found for diagnostics.',
      timestamp: now.toISOString(),
    })
    return {
      timestamp: now.toISOString(),
      overallStatus: dbOk ? 'DEGRADED' : 'CRITICAL',
      results,
    }
  }

  // 3. ESP32 Online / Link Status
  const isOnline = targetDevice.status === 'ONLINE'
  const lastSeenAgeMs = targetDevice.lastSeenAt ? now.getTime() - targetDevice.lastSeenAt.getTime() : Infinity
  const linkFresh = lastSeenAgeMs < 15000 // seen in last 15s

  results.push({
    component: 'ESP32 Wi-Fi & Link',
    status: linkFresh ? 'PASS' : isOnline ? 'WARNING' : 'FAIL',
    details: linkFresh
      ? `Heartbeat active (RSSI: ${targetDevice.rssi ?? 'N/A'} dBm, Uptime: ${targetDevice.uptimeSec ?? 0}s).`
      : `Last link activity was ${Math.round(lastSeenAgeMs / 1000)}s ago.`,
    timestamp: now.toISOString(),
  })

  // 4. Voltage Sensor Integrity
  const latestTelemetry = await Telemetry.findOne({ deviceId: targetDevice.deviceId }).sort({ timestamp: -1 })
  if (latestTelemetry && latestTelemetry.storageVoltage >= 0 && latestTelemetry.storageVoltage <= 5.5) {
    results.push({
      component: 'Supercapacitor Voltage Sensor',
      status: 'PASS',
      details: `Storage voltage within operational range (${latestTelemetry.storageVoltage.toFixed(2)} V).`,
      timestamp: now.toISOString(),
    })
  } else {
    results.push({
      component: 'Supercapacitor Voltage Sensor',
      status: latestTelemetry ? 'FAIL' : 'NOT_TESTABLE',
      details: latestTelemetry ? 'Voltage out of safe bounds or sensor railed.' : 'No telemetry available.',
      timestamp: now.toISOString(),
    })
  }

  // 5. Current Sensor Diagnostics
  if (targetDevice.hardware?.currentSensorInstalled) {
    const hasCurrent = latestTelemetry && latestTelemetry.current != null
    results.push({
      component: 'Current Sensor (INA219/INA226)',
      status: hasCurrent ? 'PASS' : 'WARNING',
      details: hasCurrent
        ? `I2C sensor reporting current (${(latestTelemetry.current! * 1000).toFixed(1)} mA).`
        : 'Hardware flagged as installed but no recent readings received.',
      timestamp: now.toISOString(),
    })
  } else {
    results.push({
      component: 'Current Sensor (INA219/INA226)',
      status: 'NOT_INSTALLED',
      details: 'Current sensor not installed on this prototype. System operates in voltage-only mode.',
      timestamp: now.toISOString(),
    })
  }

  // 6. Piezo Input & Detection Line
  results.push({
    component: 'Piezoelectric Harvester Input',
    status: latestTelemetry && latestTelemetry.footstepCount > 0 ? 'PASS' : 'NOT_TESTABLE',
    details: latestTelemetry && latestTelemetry.footstepCount > 0
      ? `Sensor line active (${latestTelemetry.footstepCount} footsteps detected).`
      : 'Waiting for mechanical footstep impulses on the piezo element.',
    timestamp: now.toISOString(),
  })

  // 7. Load Switching GPIOs (LED & Fan)
  const ledActual = targetDevice.loads?.led?.actualState
  const fanActual = targetDevice.loads?.fan?.actualState
  results.push({
    component: 'Load Control MOSFET Gates',
    status: ledActual !== null || fanActual !== null ? 'PASS' : 'NOT_TESTABLE',
    details: `GPIO Confirmation: LED actual=${ledActual ?? 'null'}, Fan actual=${fanActual ?? 'null'}.`,
    timestamp: now.toISOString(),
  })

  // 8. Configuration Synchronization State
  const desiredVer = targetDevice.configuration?.desired?.version || 1
  const appliedVer = targetDevice.configuration?.applied?.version || 1
  const syncStatus = targetDevice.configuration?.applied?.status || 'SYNCHRONIZED'

  results.push({
    component: 'Remote Configuration Sync',
    status: syncStatus === 'SYNCHRONIZED' && desiredVer === appliedVer ? 'PASS' : syncStatus === 'REJECTED' ? 'FAIL' : 'WARNING',
    details: syncStatus === 'SYNCHRONIZED' && desiredVer === appliedVer
      ? `Synchronized on v${appliedVer}.`
      : syncStatus === 'REJECTED'
      ? `Configuration v${desiredVer} rejected: ${targetDevice.configuration?.applied?.rejectionReason || 'Unknown error'}.`
      : `Pending sync (Desired: v${desiredVer}, Device: v${appliedVer}).`,
    timestamp: now.toISOString(),
  })

  const hasFails = results.some((r) => r.status === 'FAIL')
  const hasWarnings = results.some((r) => r.status === 'WARNING')
  const overallStatus = hasFails ? 'CRITICAL' : hasWarnings ? 'DEGRADED' : 'HEALTHY'

  return {
    timestamp: now.toISOString(),
    overallStatus,
    results,
  }
}
