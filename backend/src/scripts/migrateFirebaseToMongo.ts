/**
 * StepCharge AI — Firebase Realtime Database to MongoDB Migration Script
 *
 * Usage:
 *   npx tsx src/scripts/migrateFirebaseToMongo.ts /path/to/firebase-export.json
 *
 * Maps old RTDB structures:
 *   - devices/{id}                 -> Device collection
 *   - telemetry/{id}/history       -> Telemetry collection
 *   - footstepEvents/{id}/{ts}     -> Footstep collection
 *   - dataset/samples/{id}/{sid}   -> DatasetSample collection
 *   - alerts/{id}                  -> Alert collection
 *   - modelMetadata                -> ModelMetadata collection
 */

import fs from 'fs'
import path from 'path'
import mongoose from 'mongoose'
import { config } from '../config/env.js'
import { Device } from '../models/Device.js'
import { Telemetry } from '../models/Telemetry.js'
import { Footstep } from '../models/Footstep.js'
import { Alert } from '../models/Alert.js'
import { DatasetSample } from '../models/DatasetSample.js'
import { ModelMetadataModel } from '../models/ModelMetadata.js'
import { calculateStoredEnergy } from '../services/telemetryService.js'

interface FirebaseExport {
  devices?: Record<string, any>
  telemetry?: Record<string, { latest?: any; history?: Record<string, any> }>
  footstepEvents?: Record<string, Record<string, any>>
  dataset?: { samples?: Record<string, Record<string, any>> }
  alerts?: Record<string, any>
  modelMetadata?: any
}

async function runMigration() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Error: Please provide path to Firebase JSON export file.')
    console.error('Example: npx tsx src/scripts/migrateFirebaseToMongo.ts ./firebase-data.json')
    process.exit(1)
  }

  const absolutePath = path.resolve(filePath)
  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File not found at ${absolutePath}`)
    process.exit(1)
  }

  console.log(`[Migration] Reading Firebase export: ${absolutePath}`)
  const rawContent = fs.readFileSync(absolutePath, 'utf-8')
  const data: FirebaseExport = JSON.parse(rawContent)

  console.log(`[Migration] Connecting to MongoDB: ${config.mongoUri}`)
  await mongoose.connect(config.mongoUri)
  console.log('[Migration] Connected to MongoDB Atlas.')

  const summary = {
    devices: 0,
    telemetry: 0,
    footsteps: 0,
    datasetSamples: 0,
    alerts: 0,
    modelMetadata: 0,
  }

  // 1. Migrate Devices
  if (data.devices) {
    console.log('[Migration] Migrating Devices...')
    for (const [deviceId, dev] of Object.entries(data.devices)) {
      const loads = dev.loads || {}
      await Device.findOneAndUpdate(
        { deviceId },
        {
          $set: {
            deviceId,
            name: dev.name || `Device ${deviceId}`,
            location: dev.location || 'Laboratory',
            firmwareVersion: dev.firmwareVersion || '1.3.0',
            status: dev.status || 'OFFLINE',
            lastSeenAt: dev.lastSeen ? new Date(dev.lastSeen) : undefined,
            uptimeSec: dev.uptimeSec,
            rssi: dev.wifiRssi,
            loads: {
              led: {
                command: Boolean(loads.led?.command),
                actualState: typeof loads.led?.actualState === 'boolean' ? loads.led.actualState : null,
              },
              fan: {
                command: Boolean(loads.fan?.command),
                actualState: typeof loads.fan?.actualState === 'boolean' ? loads.fan.actualState : null,
              },
            },
          },
        },
        { upsert: true },
      )
      summary.devices++
    }
  }

  // 2. Migrate Telemetry History
  if (data.telemetry) {
    console.log('[Migration] Migrating Telemetry records...')
    for (const [deviceId, devTelemetry] of Object.entries(data.telemetry)) {
      const history = devTelemetry.history || {}
      const docsToInsert = []

      for (const [key, p] of Object.entries(history)) {
        if (!p || typeof p.storageVoltage !== 'number') continue
        const ts = p.timestamp ? new Date(p.timestamp) : new Date(Number(key) || Date.now())
        docsToInsert.push({
          deviceId,
          timestamp: ts,
          uptimeSec: p.uptimeSec,
          storageVoltage: p.storageVoltage,
          peakVoltage: p.peakVoltage ?? p.storageVoltage,
          averageVoltage: p.averageVoltage ?? p.storageVoltage,
          pulseDuration: p.pulseDuration ?? 100,
          stepInterval: p.stepInterval ?? 0,
          footstepCount: p.footstepCount ?? 0,
          current: p.current ?? null,
          power: p.power ?? null,
          energy: p.energy ?? null,
          estimatedStoredEnergy: calculateStoredEnergy(p.storageVoltage, 1.0),
          wifiRssi: p.wifiRssi,
          deviceStatus: p.deviceStatus || 'ONLINE',
          firmwareVersion: p.firmwareVersion,
          loadControlAvailable: Boolean(p.loadControlAvailable),
          stepClass: p.stepClass || 'UNKNOWN',
          confidence: p.confidence ?? null,
        })
      }

      if (docsToInsert.length > 0) {
        await Telemetry.insertMany(docsToInsert, { ordered: false }).catch(() => {})
        summary.telemetry += docsToInsert.length
      }
    }
  }

  // 3. Migrate Footstep Events
  if (data.footstepEvents) {
    console.log('[Migration] Migrating Footstep Events...')
    for (const [deviceId, events] of Object.entries(data.footstepEvents)) {
      const docsToInsert = []
      for (const [key, e] of Object.entries(events)) {
        if (!e) continue
        const ts = e.timestamp ? new Date(e.timestamp) : new Date(Number(key) || Date.now())
        docsToInsert.push({
          deviceId,
          timestamp: ts,
          features: {
            peakVoltage: e.peakVoltage ?? 0,
            averageVoltage: e.averageVoltage ?? 0,
            pulseDuration: e.pulseDuration ?? 0,
            stepInterval: e.stepInterval ?? 0,
            storageVoltage: e.storageVoltage ?? 0,
          },
          stepClass: e.stepClass || 'UNKNOWN',
          confidence: e.confidence ?? null,
          predictionSource: e.stepClass ? 'DEVICE PREDICTION' : 'UNCLASSIFIED',
          estimatedEnergyJ: ((e.averageVoltage ?? 0) ** 2 / 10000) * ((e.pulseDuration ?? 0) / 1000),
        })
      }

      if (docsToInsert.length > 0) {
        await Footstep.insertMany(docsToInsert, { ordered: false }).catch(() => {})
        summary.footsteps += docsToInsert.length
      }
    }
  }

  // 4. Migrate Ground-Truth Dataset Samples
  if (data.dataset?.samples) {
    console.log('[Migration] Migrating Dataset Samples...')
    for (const [deviceId, samples] of Object.entries(data.dataset.samples)) {
      for (const [sid, s] of Object.entries(samples)) {
        if (!s || !s.label || !s.features) continue
        await DatasetSample.findOneAndUpdate(
          { sampleId: s.id || sid },
          {
            $set: {
              sampleId: s.id || sid,
              deviceId: s.deviceId || deviceId,
              participantId: s.participantId,
              timestamp: s.timestamp ? new Date(s.timestamp) : new Date(),
              features: s.features,
              label: s.label,
              source: s.source || 'live',
              note: s.note,
            },
          },
          { upsert: true },
        )
        summary.datasetSamples++
      }
    }
  }

  // 5. Migrate Alerts
  if (data.alerts) {
    console.log('[Migration] Migrating Alerts...')
    for (const [aid, a] of Object.entries(data.alerts)) {
      if (!a) continue
      await Alert.create({
        deviceId: a.deviceId || 'ESP32-01',
        category: a.category || 'SYSTEM',
        type: a.type || 'SYSTEM_ALERT',
        title: a.title || 'Migrated Alert',
        reason: a.reason || '',
        severity: a.severity || 'info',
        currentValue: a.currentValue || '',
        threshold: a.threshold || '',
        action: a.action || '',
        resolved: Boolean(a.resolved || a.acknowledged),
        createdAt: a.timestamp ? new Date(a.timestamp) : new Date(),
      }).catch(() => {})
      summary.alerts++
    }
  }

  // 6. Migrate Model Metadata
  if (data.modelMetadata && data.modelMetadata.version) {
    console.log('[Migration] Migrating Model Metadata...')
    const m = data.modelMetadata
    await ModelMetadataModel.findOneAndUpdate(
      { version: m.version },
      {
        $set: {
          modelName: m.modelName || 'Random Forest (scikit-learn)',
          version: m.version,
          datasetVersion: m.datasetVersion,
          featureCount: m.featureCount || 5,
          classes: m.classes || ['LIGHT', 'NORMAL', 'HEAVY'],
          metrics: m.metrics,
          confusionMatrix: m.confusionMatrix,
          featureImportance: m.featureImportance,
          samples: m.samples,
          labelDistribution: m.labelDistribution,
          evaluationMethod: m.evaluationMethod,
          evaluationDetail: m.evaluationDetail,
          subjectIndependent: m.subjectIndependent,
          participants: m.participants,
          warnings: m.warnings,
          trainedAt: m.trainedAt ? new Date(m.trainedAt) : undefined,
          isCurrent: true,
        },
      },
      { upsert: true },
    )
    summary.modelMetadata++
  }

  console.log('\n================ MIGRATION REPORT ================')
  console.log(`Devices migrated:        ${summary.devices}`)
  console.log(`Telemetry rows migrated: ${summary.telemetry}`)
  console.log(`Footsteps migrated:      ${summary.footsteps}`)
  console.log(`Dataset samples:         ${summary.datasetSamples}`)
  console.log(`Alerts migrated:         ${summary.alerts}`)
  console.log(`Model metadata:          ${summary.modelMetadata}`)
  console.log('==================================================\n')

  await mongoose.disconnect()
  console.log('[Migration] Migration complete. Disconnected from MongoDB.')
}

runMigration().catch((err) => {
  console.error('[Migration] Migration failed with error:', err)
  process.exit(1)
})
