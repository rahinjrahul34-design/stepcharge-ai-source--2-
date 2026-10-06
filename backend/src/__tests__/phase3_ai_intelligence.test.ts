import { describe, it, expect, beforeEach, vi } from 'vitest'
import { validateDatasetQuality } from '../services/dataQualityService.js'
import {
  promoteModel,
  rollbackModel,
  archiveModel,
} from '../services/modelRegistryService.js'
import { ModelMetadataModel } from '../models/ModelMetadata.js'
import { AnomalyEvent } from '../models/AnomalyEvent.js'
import { detectAndRecordAnomaly } from '../services/aiAnomalyService.js'
import {
  getEnergyAnalytics,
  getPiezoHealth,
  getStorageIntelligence,
  getExplainableDeviceHealth,
} from '../services/aiIntelligenceService.js'
import { generateAIInsights } from '../services/aiInsightsService.js'
import { Footstep } from '../models/Footstep.js'
import { Telemetry } from '../models/Telemetry.js'
import { Device } from '../models/Device.js'
import { AuditLog } from '../models/AuditLog.js'

describe('Phase 3: AI Intelligence, Model Registry & Analytics Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any)
  })

  describe('1. Data Quality Gate', () => {
    it('returns empty evaluation and recommendations for empty dataset', async () => {
      const res = await validateDatasetQuality([])
      expect(res.isValid).toBe(false)
      expect(res.totalSamples).toBe(0)
      expect(res.isReadyForTraining).toBe(false)
      expect(res.recommendations[0]).toContain('Dataset is completely empty')
    })

    it('identifies physical outliers and penalizes quality score', async () => {
      const samples = [
        {
          participantId: 'P001',
          label: 'NORMAL',
          peakVoltage: 55.0, // Outlier (> 50 V)
          averageVoltage: 10.0,
          pulseDuration: 200,
          stepInterval: 1.2,
          storageVoltage: 3.5,
        },
        {
          participantId: 'P001',
          label: 'NORMAL',
          peakVoltage: 3.0,
          averageVoltage: 4.5, // Impossible: average > peak
          pulseDuration: 200,
          stepInterval: 1.2,
          storageVoltage: 3.5,
        },
      ]
      const res = await validateDatasetQuality(samples as any)
      expect(res.outliersCount).toBeGreaterThanOrEqual(1)
      expect(res.qualityScore).toBeLessThan(100)
    })

    it('passes clean, diverse dataset with 2+ participants', async () => {
      const samples: any[] = []
      for (let i = 0; i < 30; i++) {
        samples.push({
          participantId: `P00${(i % 2) + 1}`,
          label: ['LIGHT', 'NORMAL', 'HEAVY'][i % 3],
          peakVoltage: 2.0 + (i % 3),
          averageVoltage: 0.8 + (i % 3) * 0.3,
          pulseDuration: 180,
          stepInterval: 1.0,
          storageVoltage: 3.5,
        })
      }
      const res = await validateDatasetQuality(samples)
      expect(res.isValid).toBe(true)
      expect(res.totalSamples).toBe(30)
      expect(res.uniqueParticipants).toBe(2)
      expect(res.isReadyForTraining).toBe(true)
      expect(res.qualityScore).toBeGreaterThanOrEqual(80)
    })
  })

  describe('2. Model Registry & Lifecycle Governance', () => {
    let mockModels: any[] = []

    beforeEach(() => {
      mockModels = [
        {
          modelName: 'Random Forest',
          version: 'rf-v1.0',
          algorithm: 'Random Forest',
          status: 'PRODUCTION',
          featureVersion: 'features-v1',
          featureCount: 5,
          isCurrent: true,
          metrics: { accuracy: 0.88, precision: 0.87, recall: 0.86, f1: 0.865 },
          rollbackHistory: [],
          save: vi.fn().mockImplementation(function (this: any) {
            return Promise.resolve(this)
          }),
        },
        {
          modelName: 'Gradient Boosting',
          version: 'gb-v1.0',
          algorithm: 'Gradient Boosting',
          status: 'VALIDATION',
          featureVersion: 'features-v1',
          featureCount: 5,
          isCurrent: false,
          metrics: { accuracy: 0.91, precision: 0.90, recall: 0.89, f1: 0.895 },
          rollbackHistory: [],
          save: vi.fn().mockImplementation(function (this: any) {
            return Promise.resolve(this)
          }),
        },
      ]

      vi.spyOn(ModelMetadataModel, 'findOne').mockImplementation((query: any) => {
        if (query.version) {
          const found = mockModels.find((m) => m.version === query.version)
          return Promise.resolve(found || null) as any
        }
        if (query.status === 'PRODUCTION') {
          const found = mockModels.find((m) => m.status === 'PRODUCTION' && m.isCurrent)
          return Promise.resolve(found || null) as any
        }
        return Promise.resolve(null) as any
      })
    })

    it('promotes validation model to production and archives previous production model', async () => {
      const promoted = await promoteModel('gb-v1.0', 'admin@stepcharge.io')
      expect(promoted.status).toBe('PRODUCTION')
      expect(promoted.isCurrent).toBe(true)

      const oldProd = mockModels.find((m) => m.version === 'rf-v1.0')
      expect(oldProd?.status).toBe('ARCHIVED')
      expect(oldProd?.isCurrent).toBe(false)
    })

    it('rolls back production model to previous version and records audit history', async () => {
      await promoteModel('gb-v1.0', 'admin@stepcharge.io')
      const rolledBack = await rollbackModel(
        'rf-v1.0',
        'Gradient Boosting showed inference latency spike in real hardware',
        undefined,
        'engineer@stepcharge.io',
      )

      expect(rolledBack.status).toBe('PRODUCTION')
      expect(rolledBack.rollbackHistory.length).toBe(1)
      expect(rolledBack.rollbackHistory[0].fromVersion).toBe('gb-v1.0')
      expect(rolledBack.rollbackHistory[0].toVersion).toBe('rf-v1.0')
      expect(rolledBack.rollbackHistory[0].reason).toContain('inference latency spike')
    })

    it('refuses to archive the active production model', async () => {
      await expect(archiveModel('rf-v1.0')).rejects.toThrow('Cannot archive the active production model')
    })
  })

  describe('3. Anomaly Detection & Explainability', () => {
    beforeEach(() => {
      vi.spyOn(AnomalyEvent, 'create').mockImplementation((doc: any) =>
        Promise.resolve({
          _id: 'mock-anomaly-id',
          ...doc,
        }) as any,
      )
    })

    it('triggers CRITICAL rule-based anomaly on supercapacitor overvoltage (> 5.5 V)', async () => {
      const event = await detectAndRecordAnomaly(
        {
          peakVoltage: 3.5,
          averageVoltage: 1.2,
          pulseDuration: 180,
          stepInterval: 1.0,
          storageVoltage: 5.85,
        },
        'ESP32-TEST-01',
      )

      expect(event).not.toBeNull()
      expect(event?.anomalyType).toBe('STORAGE_ANOMALY')
      expect(event?.severity).toBe('CRITICAL')
      expect(event?.source).toBe('RULE-BASED')
      expect(event?.observedValue).toBe('5.85 V')
      expect(event?.possibleCause).toContain('maximum ceiling')
    })

    it('triggers HIGH anomaly on severe kinetic voltage spike (> 35 V)', async () => {
      const event = await detectAndRecordAnomaly(
        {
          peakVoltage: 42.0,
          averageVoltage: 8.0,
          pulseDuration: 150,
          stepInterval: 1.0,
          storageVoltage: 3.2,
        },
        'ESP32-TEST-01',
      )

      expect(event).not.toBeNull()
      expect(event?.anomalyType).toBe('VOLTAGE_SPIKE')
      expect(event?.severity).toBe('HIGH')
      expect(event?.observedValue).toBe('42.00 V')
    })
  })

  describe('4. Energy Analytics & Device Health Breakdown', () => {
    const testDeviceId = 'ESP32-TEST-AI'

    const mockFootsteps = [
      {
        deviceId: testDeviceId,
        timestamp: new Date(),
        features: {
          peakVoltage: 3.2,
          averageVoltage: 1.4,
          pulseDuration: 220,
          stepInterval: 1.1,
          storageVoltage: 4.0,
        },
        stepClass: 'NORMAL',
        confidence: 0.85,
        measuredEnergyJ: 0.045, // real current measured
      },
      {
        deviceId: testDeviceId,
        timestamp: new Date(),
        features: {
          peakVoltage: 4.8,
          averageVoltage: 2.1,
          pulseDuration: 280,
          stepInterval: 0.9,
          storageVoltage: 4.2,
        },
        stepClass: 'HEAVY',
        confidence: 0.92,
        measuredEnergyJ: 0.082,
      },
    ]

    const mockTelemetryList = [
      {
        deviceId: testDeviceId,
        timestamp: new Date(),
        storageVoltage: 4.1,
        peakVoltage: 3.5,
        averageVoltage: 1.5,
        pulseDuration: 200,
        footstepCount: 2,
        power: 0.025, // 25 mW
        current: 0.006, // 6 mA
        wifiRssi: -58,
        deviceStatus: 'ONLINE',
        uptimeSec: 3600,
        sequenceNumber: 10,
      },
    ]

    const mockDeviceDoc = {
      deviceId: testDeviceId,
      name: 'AI Test Unit',
      location: 'Lab 1',
      firmwareVersion: '2.1.0',
      status: 'ONLINE',
      isRevoked: false,
      configuration: {
        desired: { version: 2, supercapFarads: 10.0, storageMaxSafeVoltage: 5.0, storageLowVoltage: 2.0 },
        applied: { version: 2, status: 'SYNCHRONIZED' },
      },
    }

    beforeEach(() => {
      // Mock Footstep.aggregate
      vi.spyOn(Footstep, 'aggregate').mockImplementation((pipeline: any[]) => {
        const group = pipeline.find((stage) => stage.$group)?.$group || {}
        expect(group.sumPeakV.$sum).toBe('$features.peakVoltage')
        expect(group.avgPeakV.$avg).toBe('$features.peakVoltage')

        const matched = mockFootsteps.filter((step) => step.deviceId === testDeviceId)
        if (matched.length === 0) return Promise.resolve([]) as any

        return Promise.resolve([
          {
            _id: null,
            totalSteps: matched.length,
            sumPeakV: matched.reduce((sum, step) => sum + step.features.peakVoltage, 0),
            avgPeakV:
              matched.reduce((sum, step) => sum + step.features.peakVoltage, 0) / matched.length,
            sumMeasuredEnergy: matched.reduce((sum, step) => sum + step.measuredEnergyJ, 0),
            measuredEnergyCount: matched.filter((step) => step.measuredEnergyJ > 0).length,
          },
        ]) as any
      })

      // Mock Telemetry.aggregate
      vi.spyOn(Telemetry, 'aggregate').mockResolvedValue([
        {
          _id: null,
          avgStorageV: 4.1,
          latestStorageV: 4.1,
          avgPower: 0.025,
          maxPower: 0.030,
          powerCount: 1,
        },
      ])

      // Mock Footstep.find
      vi.spyOn(Footstep, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockFootsteps),
        then: (resolve: any) => Promise.resolve(mockFootsteps).then(resolve),
      } as any)

      // Mock Telemetry.find
      vi.spyOn(Telemetry, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockTelemetryList),
        then: (resolve: any) => Promise.resolve(mockTelemetryList).then(resolve),
      } as any)

      // Mock Telemetry.findOne
      vi.spyOn(Telemetry, 'findOne').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockTelemetryList[0]),
        then: (resolve: any) => Promise.resolve(mockTelemetryList[0]).then(resolve),
      } as any)

      // Mock Device.findOne
      vi.spyOn(Device, 'findOne').mockResolvedValue(mockDeviceDoc as any)

      // Mock AnomalyEvent.countDocuments
      vi.spyOn(AnomalyEvent, 'countDocuments').mockResolvedValue(0)

      // Mock ModelMetadataModel.findOne for insights
      vi.spyOn(ModelMetadataModel, 'findOne').mockResolvedValue({
        modelName: 'Random Forest',
        version: 'rf-v1.0',
        metrics: { accuracy: 0.88, precision: 0.87, recall: 0.86, f1: 0.865 },
        participants: 5,
        evaluationMethod: 'GroupKFold (Subject-Independent)',
      } as any)
    })

    it('aggregates real measured energy and computes energy per step', async () => {
      const analytics = await getEnergyAnalytics(testDeviceId, 'day')
      expect(analytics.totalFootsteps).toBe(2)
      expect(analytics.averageStepVoltageV).toBe(4)
      expect(analytics.totalMeasuredEnergyJ).toBe(0.127) // 0.045 + 0.082
      expect(analytics.energyPerStepJ).toBe(0.0635) // 0.127 / 2
      expect(analytics.energyPerStepType).toBe('MEASURED')
      expect(analytics.averagePowerMw).toBe(25) // 0.025 W * 1000
    })

    it('handles zero, one, and multiple realistic nested-footstep aggregates without null formatting failures', async () => {
      const originalFootsteps = [...mockFootsteps]

      for (const sample of [
        [],
        [originalFootsteps[0]],
        originalFootsteps,
      ]) {
        vi.mocked(Footstep.aggregate).mockImplementationOnce((pipeline: any[]) => {
          const group = pipeline.find((stage) => stage.$group)?.$group || {}
          expect(group.sumPeakV.$sum).toBe('$features.peakVoltage')
          expect(group.avgPeakV.$avg).toBe('$features.peakVoltage')

          if (sample.length === 0) return Promise.resolve([]) as any
          return Promise.resolve([
            {
              _id: null,
              totalSteps: sample.length,
              sumPeakV: sample.reduce((sum, step) => sum + step.features.peakVoltage, 0),
              avgPeakV: sample.reduce((sum, step) => sum + step.features.peakVoltage, 0) / sample.length,
              sumMeasuredEnergy: sample.reduce((sum, step) => sum + step.measuredEnergyJ, 0),
              measuredEnergyCount: sample.filter((step) => step.measuredEnergyJ > 0).length,
            },
          ]) as any
        })

        const analytics = await getEnergyAnalytics(testDeviceId, 'day')
        expect(Number.isFinite(analytics.averageStepVoltageV)).toBe(true)
        expect(Number.isFinite(analytics.estimatedStoredEnergyJ)).toBe(true)
        expect(analytics.averageStepVoltageV).not.toBeNull()
      }
    })

    it('reports supercapacitor storage intelligence with safe voltage limits', async () => {
      const storage = await getStorageIntelligence(testDeviceId)
      expect(storage.currentVoltage).toBe(4.1)
      expect(storage.maxVoltage).toBe(5.0)
      expect(storage.alertState).toBe('NORMAL')
      expect(storage.estimatedStoredEnergyJ).toBeGreaterThan(0)
    })

    it('generates line-item explainable device health score', async () => {
      const health = await getExplainableDeviceHealth(testDeviceId)
      expect(health.overallScore).toBeGreaterThanOrEqual(80)
      expect(health.status).toBe('HEALTHY')
      expect(health.breakdown.length).toBe(4)
      expect(health.breakdown.some((b) => b.category.includes('Wi-Fi'))).toBe(true)
      expect(health.breakdown.some((b) => b.category.includes('Supercapacitor'))).toBe(true)
    })

    it('generates evidence-backed research insights', async () => {
      const insights = await generateAIInsights(testDeviceId)
      expect(insights.length).toBeGreaterThan(0)
      expect(insights.some((i) => i.insightType === 'DOMINANT_GAIT_PATTERN')).toBe(true)
      expect(insights.some((i) => i.insightType === 'PEAK_VOLTAGE_CORRELATION')).toBe(true)
    })
  })
})
