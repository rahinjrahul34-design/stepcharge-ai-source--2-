import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  compareExperiments,
  getStatisticalAnalysis,
  getCorrelationMatrix,
  generateResearchReport,
} from '../services/experimentService.js'
import { ExperimentSession } from '../models/ExperimentSession.js'
import { DatasetSample } from '../models/DatasetSample.js'
import { Device } from '../models/Device.js'
import { Telemetry } from '../models/Telemetry.js'
import { AuditLog } from '../models/AuditLog.js'
import { getSystemMonitor } from '../controllers/systemController.js'
import * as mlClientService from '../services/mlClientService.js'
import mongoose from 'mongoose'

describe('Phase 4: Research Validation, Statistical Analysis & System Reliability Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any)
    vi.spyOn(mlClientService, 'checkMlHealth').mockResolvedValue({
      reachable: true,
      modelLoaded: true,
      version: '1.0.0',
    })
  })

  describe('1. Statistical Analysis & Hypothesis Testing', () => {
    it('returns empty structure when no footstep samples exist', async () => {
      vi.spyOn(DatasetSample, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      } as any)

      const res = await getStatisticalAnalysis()
      expect(res.status).toBe('INSUFFICIENT_DATA')
      expect(res.metrics).toBeNull()
      expect(res.hypothesisTest).toBeNull()
    })

    it('computes accurate parametric & non-parametric metrics with Kruskal-Wallis test', async () => {
      const mockSamples = [
        { label: 'LIGHT', features: { peakVoltage: 2.1, pulseDuration: 80, stepInterval: 1.2, storageVoltage: 3.1 }, measuredEnergyJ: 0.0001 },
        { label: 'LIGHT', features: { peakVoltage: 2.3, pulseDuration: 85, stepInterval: 1.15, storageVoltage: 3.11 }, measuredEnergyJ: 0.00011 },
        { label: 'LIGHT', features: { peakVoltage: 2.5, pulseDuration: 90, stepInterval: 1.1, storageVoltage: 3.12 }, measuredEnergyJ: 0.00012 },
        { label: 'NORMAL', features: { peakVoltage: 7.2, pulseDuration: 135, stepInterval: 0.95, storageVoltage: 3.18 }, measuredEnergyJ: 0.00045 },
        { label: 'NORMAL', features: { peakVoltage: 7.5, pulseDuration: 140, stepInterval: 0.9, storageVoltage: 3.2 }, measuredEnergyJ: 0.0005 },
        { label: 'NORMAL', features: { peakVoltage: 8.0, pulseDuration: 150, stepInterval: 0.85, storageVoltage: 3.22 }, measuredEnergyJ: 0.00055 },
        { label: 'HEAVY', features: { peakVoltage: 15.5, pulseDuration: 210, stepInterval: 0.75, storageVoltage: 3.35 }, measuredEnergyJ: 0.0016 },
        { label: 'HEAVY', features: { peakVoltage: 16.2, pulseDuration: 220, stepInterval: 0.7, storageVoltage: 3.4 }, measuredEnergyJ: 0.0018 },
        { label: 'HEAVY', features: { peakVoltage: 18.0, pulseDuration: 240, stepInterval: 0.65, storageVoltage: 3.45 }, measuredEnergyJ: 0.002 },
      ]

      vi.spyOn(DatasetSample, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockSamples),
      } as any)

      const res = await getStatisticalAnalysis()
      expect(res.status).toBe('SUCCESS')
      expect(res.totalSamples).toBe(9)
      expect(res.metrics).toBeDefined()
      expect(res.metrics?.peakVoltage?.mean).toBeGreaterThan(0)
      expect(res.metrics?.peakVoltage?.median).toBeGreaterThan(0)
      expect(res.metrics?.peakVoltage?.q1).toBeLessThanOrEqual(res.metrics?.peakVoltage?.q3!)
      expect(res.hypothesisTest).toBeDefined()
      expect(res.hypothesisTest.testName).toContain('Kruskal-Wallis')
      expect(res.hypothesisTest.hStatistic).toBeGreaterThan(0)
    })
  })

  describe('2. Correlation Matrix Analysis', () => {
    it('generates Pearson and Spearman pairwise matrix with scientific disclaimer', async () => {
      const mockSamples = [
        { features: { peakVoltage: 2.0, averageVoltage: 0.8, pulseDuration: 80, stepInterval: 1.5, storageVoltage: 3.1 } },
        { features: { peakVoltage: 5.0, averageVoltage: 2.0, pulseDuration: 120, stepInterval: 1.1, storageVoltage: 3.2 } },
        { features: { peakVoltage: 8.0, averageVoltage: 3.5, pulseDuration: 150, stepInterval: 0.9, storageVoltage: 3.3 } },
        { features: { peakVoltage: 12.0, averageVoltage: 5.0, pulseDuration: 190, stepInterval: 0.8, storageVoltage: 3.4 } },
        { features: { peakVoltage: 16.0, averageVoltage: 7.0, pulseDuration: 230, stepInterval: 0.7, storageVoltage: 3.5 } },
      ]

      vi.spyOn(DatasetSample, 'find').mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockSamples),
        }),
      } as any)

      const res = await getCorrelationMatrix()
      expect(res.status).toBe('SUCCESS')
      expect(res.sampleCount).toBe(5)
      expect(res.pairs.length).toBeGreaterThan(0)
      expect(res.disclaimer).toContain('Statistical correlation evaluates empirical co-variation')
      const firstPair = res.pairs[0]
      expect(firstPair.pearson).toBeDefined()
      expect(firstPair.spearman).toBeDefined()
      expect(firstPair.interpretation).toBeDefined()
    })
  })

  describe('3. Experiment Comparison', () => {
    it('compares multiple sessions and reports physical electrical metrics', async () => {
      const session1 = {
        sessionId: 'sess-001',
        experimentName: 'Walking Test',
        participantId: 'P01',
        stepClass: 'NORMAL',
        status: 'COMPLETED',
        targetSteps: 50,
        collectedSteps: 50,
        rejectedSteps: 0,
        storageStartVoltage: 2.0,
        storageEndVoltage: 2.2,
      }
      const session2 = {
        sessionId: 'sess-002',
        experimentName: 'Running Test',
        participantId: 'P02',
        stepClass: 'HEAVY',
        status: 'COMPLETED',
        targetSteps: 50,
        collectedSteps: 50,
        rejectedSteps: 1,
        storageStartVoltage: 2.2,
        storageEndVoltage: 2.6,
      }

      vi.spyOn(ExperimentSession, 'find').mockResolvedValue([session1, session2] as any)

      vi.spyOn(DatasetSample, 'find').mockImplementation((query: any) => {
        const isSess1 = query?.sessionId === 'sess-001'
        const samples = isSess1
          ? [
              { features: { peakVoltage: 6.5, pulseDuration: 130, storageVoltage: 2.1 }, measuredEnergyJ: 0.0004 },
              { features: { peakVoltage: 7.0, pulseDuration: 140, storageVoltage: 2.2 }, measuredEnergyJ: 0.0005 },
            ]
          : [
              { features: { peakVoltage: 15.0, pulseDuration: 210, storageVoltage: 2.4 }, measuredEnergyJ: 0.0019 },
              { features: { peakVoltage: 16.0, pulseDuration: 220, storageVoltage: 2.6 }, measuredEnergyJ: 0.0021 },
            ]
        return {
          lean: vi.fn().mockResolvedValue(samples),
        } as any
      })

      const res = await compareExperiments(['sess-001', 'sess-002'])
      expect(res).toHaveLength(2)
      expect(res[0].name).toBe('Walking Test')
      expect(res[0].energy.type).toBe('MEASURED')
      expect(res[0].peakVoltage.mean).toBeCloseTo(6.75, 2)
      expect(res[1].name).toBe('Running Test')
      expect(res[1].peakVoltage.mean).toBeCloseTo(15.5, 2)
    })
  })

  describe('4. Research Report Generation', () => {
    it('compiles full 17-section research document in Markdown format', async () => {
      vi.spyOn(ExperimentSession, 'findOne').mockResolvedValue(null)
      vi.spyOn(DatasetSample, 'find').mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      } as any)

      const report = await generateResearchReport(undefined, 'STEPCHARGE_DEV_01')
      expect(typeof report).toBe('string')
      expect(report).toContain('# StepCharge AI — Comprehensive Academic Research & Engineering Report')
      expect(report).toContain('## 1. Project Information')
      expect(report).toContain('## 3. Hardware Configuration')
      expect(report).toContain('## 17. Reproducibility & Governance Information')
      expect(report).toContain('Anti-Fabrication Pledge')
    })
  })

  describe('5. System Monitor Controller', () => {
    it('returns live multi-service health and latency breakdown', async () => {
      vi.spyOn(Device, 'findOne').mockResolvedValue({
        deviceId: 'STEPCHARGE_DEV_01',
        lastSeenAt: new Date(),
      } as any)

      vi.spyOn(Telemetry, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([
              { sequence: 10, createdAt: new Date() },
              { sequence: 9, createdAt: new Date(Date.now() - 1000) },
            ]),
          }),
        }),
      } as any)

      vi.spyOn(Telemetry, 'findOne').mockReturnValue({
        lean: vi.fn().mockResolvedValue({}),
      } as any)

      const req: any = { query: { deviceId: 'STEPCHARGE_DEV_01' } }
      let jsonResult: any = null
      const res: any = {
        json: (data: any) => {
          jsonResult = data
          return res
        },
        status: () => res,
      }

      await getSystemMonitor(req, res)
      expect(jsonResult).toBeDefined()
      expect(jsonResult.success).toBe(true)
      expect(jsonResult.data.services).toBeDefined()
      expect(jsonResult.data.services.backend.status).toBe('ONLINE')
      expect(jsonResult.data.endToEndLatency).toBeDefined()
      expect(jsonResult.data.telemetryReliability).toBeDefined()
      expect(jsonResult.data.telemetryReliability.successRatePercent).toBeDefined()
    })
  })
})
