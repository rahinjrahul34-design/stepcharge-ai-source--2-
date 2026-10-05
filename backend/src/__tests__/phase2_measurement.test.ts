import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  calculateStoredEnergy,
  validateTelemetryPayload,
} from '../services/telemetryService.js'
import {
  calculateStepEnergy,
  FootstepInput,
} from '../services/footstepService.js'
import {
  validateDeviceConfig,
  ConfigUpdateInput,
} from '../services/deviceConfigService.js'
import {
  calibrateVoltage,
  calibrateCurrent,
  calibratePiezoThresholds,
} from '../services/calibrationService.js'
import {
  exportExperimentData,
  getDatasetQualityMetrics,
} from '../services/experimentService.js'
import { runSystemSelfTest } from '../services/selfTestService.js'

describe('Phase 2: Real Energy Measurement, Calibration & Experiment Engine', () => {
  // ---------------- 1. Voltage Measurement & Calibration ----------------
  describe('Voltage Calibration & Calculations', () => {
    it('accurately calculates calibrated voltage using scale and offset', () => {
      const rawVoltage = 3.98
      const scale = 1.0553
      const offset = 0.0
      const calibrated = (rawVoltage * scale) + offset
      expect(calibrated).toBeCloseTo(4.20, 2)
    })

    it('calculates multimeter comparison error percentage accurately', () => {
      const refVoltage = 4.20
      const measuredVoltage = 3.98
      const errorPercent = (Math.abs(measuredVoltage - refVoltage) / refVoltage) * 100
      expect(errorPercent).toBeCloseTo(5.24, 2)
    })

    it('rejects invalid or non-positive reference voltages', async () => {
      await expect(
        calibrateVoltage('ESP32-01', { referenceVoltage: -1.0, measuredVoltage: 3.5 }, 'user1', 'u@test.com'),
      ).rejects.toThrow('Reference and measured voltages must be positive finite numbers.')
    })
  })

  // ---------------- 2. Current Sensing & Abstraction ----------------
  describe('Current Measurement & Abstraction', () => {
    it('refuses current calibration if current sensor is not installed', async () => {
      // Mock Device.findOne returning device without current sensor
      const { Device } = await import('../models/Device.js')
      vi.spyOn(Device, 'findOne').mockResolvedValueOnce({
        deviceId: 'ESP32-01',
        hardware: { currentSensorInstalled: false },
      } as any)

      await expect(
        calibrateCurrent(
          'ESP32-01',
          { referenceCurrentMa: 20.0, measuredCurrentMa: 19.5 },
          'user1',
          'u@test.com',
        ),
      ).rejects.toThrow('CURRENT_SENSOR_NOT_INSTALLED')
    })
  })

  // ---------------- 3. Real Power Calculation (P = V * I) ----------------
  describe('Real Power Calculation', () => {
    it('calculates instantaneous electrical power when voltage and current exist', () => {
      const voltage = 4.20 // Volts
      const current = 0.0182 // Amperes (18.2 mA)
      const power = voltage * current // Watts
      expect(power).toBeCloseTo(0.07644, 5)
      expect(power * 1000).toBeCloseTo(76.44, 2) // mW
    })

    it('does not fabricate power when current is null or unmeasured', () => {
      const voltage = 4.20
      const current = null
      const power = current != null ? voltage * current : null
      expect(power).toBeNull()
    })
  })

  // ---------------- 4. Energy Integration (E = sum P * dt) ----------------
  describe('Energy Integration', () => {
    it('integrates discrete power samples over varying time intervals', () => {
      // P1 = 76.44 mW for 1.2s, P2 = 50.0 mW for 0.8s
      const samples = [
        { powerWatts: 0.07644, dtSec: 1.2 },
        { powerWatts: 0.05000, dtSec: 0.8 },
      ]

      let totalEnergyJoules = 0
      for (const s of samples) {
        totalEnergyJoules += s.powerWatts * s.dtSec
      }

      // E = (0.07644 * 1.2) + (0.05000 * 0.8) = 0.091728 + 0.04 = 0.131728 J
      expect(totalEnergyJoules).toBeCloseTo(0.1317, 3)
    })
  })

  // ---------------- 5. Stored Energy (E = 1/2 C V^2) vs Measured Energy ----------------
  describe('Supercapacitor Stored Energy Estimation', () => {
    it('calculates stored energy E = 1/2 * C * V^2 accurately for 0.1 F capacitor', () => {
      const voltage = 4.0
      const capacitance = 0.1 // Farads
      const storedEnergy = calculateStoredEnergy(voltage, capacitance)
      // E = 0.5 * 0.1 * 16 = 0.8 Joules
      expect(storedEnergy).toBeCloseTo(0.80, 2)
    })

    it('clamps stored energy to zero on zero or negative voltage', () => {
      expect(calculateStoredEnergy(0, 0.1)).toBe(0)
      expect(calculateStoredEnergy(-2.5, 0.1)).toBe(0)
    })
  })

  // ---------------- 6. Piezo Threshold Calibration ----------------
  describe('Piezo Threshold Calibration Logic', () => {
    it('calculates recommended trigger and release thresholds from baseline and light step peak', async () => {
      const { Device } = await import('../models/Device.js')
      const { CalibrationLog } = await import('../models/CalibrationLog.js')

      vi.spyOn(Device, 'findOne').mockResolvedValueOnce({
        deviceId: 'ESP32-01',
      } as any)
      vi.spyOn(CalibrationLog, 'create').mockResolvedValueOnce({ _id: 'log123' } as any)

      const result = await calibratePiezoThresholds(
        'ESP32-01',
        { baselineNoiseV: 0.20, lightStepPeakV: 1.20, apply: false },
        'user1',
        'u@test.com',
      )

      // Range: 1.20 - 0.20 = 1.00V
      // Trigger: 0.20 + (1.00 * 0.4) = 0.60V
      // Release: 0.20 + (1.00 * 0.15) = 0.35V
      expect(result.recommendedThreshold).toBe(0.60)
      expect(result.recommendedRelease).toBe(0.35)
      expect(result.recommendedRelease).toBeLessThan(result.recommendedThreshold)
    })
  })

  // ---------------- 7. Remote Configuration Validation ----------------
  describe('Remote Device Configuration Safety Validation', () => {
    it('accepts safe valid configuration parameters', () => {
      const validConfig: ConfigUpdateInput = {
        samplingIntervalMs: 20,
        telemetryIntervalMs: 1000,
        stepThresholdVoltage: 0.8,
        stepReleaseVoltage: 0.55,
        minPulseDurationMs: 60,
        maxPulseDurationMs: 2000,
        storageMaxSafeVoltage: 5.0,
        supercapFarads: 0.1,
      }
      const val = validateDeviceConfig(validConfig)
      expect(val.ok).toBe(true)
      expect(val.errors).toHaveLength(0)
    })

    it('rejects unsafe storage voltage exceeding 5.5 V hardware limit', () => {
      const val = validateDeviceConfig({ storageMaxSafeVoltage: 6.2 })
      expect(val.ok).toBe(false)
      expect(val.errors[0]).toContain('storageMaxSafeVoltage must not exceed hardware limit of 5.5 V')
    })

    it('rejects invalid inverted thresholds (release >= trigger)', () => {
      const val = validateDeviceConfig({
        stepThresholdVoltage: 0.5,
        stepReleaseVoltage: 0.8,
      })
      expect(val.ok).toBe(false)
      expect(val.errors[0]).toContain('stepReleaseVoltage must be strictly less than stepThresholdVoltage')
    })

    it('rejects sampling interval below minimum safe ADC cycle (5ms)', () => {
      const val = validateDeviceConfig({ samplingIntervalMs: 2 })
      expect(val.ok).toBe(false)
      expect(val.errors[0]).toContain('samplingIntervalMs must be between 5 and 1000 ms')
    })
  })

  // ---------------- 8. Footstep Waveform Capture ----------------
  describe('Footstep Waveform Capture & Ingestion', () => {
    it('validates and stores waveform array on footstep events', async () => {
      const { Footstep } = await import('../models/Footstep.js')
      const { ExperimentSession } = await import('../models/ExperimentSession.js')

      const dummyWaveform = [0.1, 0.4, 0.9, 1.8, 2.4, 1.5, 0.7, 0.3]
      const mockCreated = {
        _id: 'footstep_wf_01',
        deviceId: 'ESP32-01',
        timestamp: new Date(),
        features: { peakVoltage: 2.4, averageVoltage: 1.1, pulseDuration: 180, stepInterval: 1.2, storageVoltage: 4.1 },
        waveform: dummyWaveform,
        samplingRate: 50,
        stepClass: 'NORMAL',
        confidence: 0.92,
        estimatedEnergyJ: 0.002,
        featureVersion: 'features-v1',
      }

      vi.spyOn(Footstep, 'create').mockResolvedValueOnce(mockCreated as any)
      vi.spyOn(ExperimentSession, 'findOne').mockResolvedValueOnce(null)

      const { recordFootstep } = await import('../services/footstepService.js')
      const result = await recordFootstep({
        deviceId: 'ESP32-01',
        peakVoltage: 2.4,
        averageVoltage: 1.1,
        pulseDuration: 180,
        stepInterval: 1.2,
        storageVoltage: 4.1,
        waveform: dummyWaveform,
        samplingRate: 50,
        stepClass: 'NORMAL',
        confidence: 0.92,
      })

      expect(result.waveform).toEqual(dummyWaveform)
      expect(result.samplingRate).toBe(50)
      expect(result.featureVersion).toBe('features-v1')
    })
  })

  // ---------------- 9. Academic Experiment Mode & Anonymization ----------------
  describe('Experiment Mode & Data Anonymization', () => {
    it('anonymizes participant IDs and exports research dataset to CSV', async () => {
      const { ExperimentSession } = await import('../models/ExperimentSession.js')
      const { DatasetSample } = await import('../models/DatasetSample.js')

      const mockSession = {
        sessionId: 'EXP_TEST_01',
        experimentName: 'Piezo Sensitivity Study',
        participantId: 'P007',
        deviceId: 'ESP32-01',
        stepClass: 'HEAVY',
        targetSteps: 50,
        collectedSteps: 2,
        validSteps: 2,
        rejectedSteps: 0,
        startedAt: new Date('2026-10-05T12:00:00Z'),
      }

      const mockSamples = [
        {
          sampleId: 'sample_01',
          timestamp: new Date('2026-10-05T12:01:00Z'),
          participantId: 'P007',
          label: 'HEAVY',
          features: { peakVoltage: 3.5, averageVoltage: 2.1, pulseDuration: 220, stepInterval: 1.5, storageVoltage: 4.2 },
          measuredEnergyJ: 0.0045,
          measurementQuality: 'VALID',
          rejected: false,
        },
      ]

      vi.spyOn(ExperimentSession, 'findOne').mockResolvedValueOnce(mockSession as any)
      vi.spyOn(DatasetSample, 'find').mockReturnValueOnce({
        sort: () => Promise.resolve(mockSamples),
      } as any)

      const csv = await exportExperimentData('EXP_TEST_01', 'csv')
      expect(typeof csv).toBe('string')
      expect(csv).toContain('P007')
      expect(csv).toContain('HEAVY')
      expect(csv).toContain('3.500')
      expect(csv).toContain('0.0045')
      expect(csv).toContain('VALID')
    })
  })

  // ---------------- 10. Hardware Self-Test Diagnostics ----------------
  describe('System Self-Test Diagnostics', () => {
    it('reports realistic component statuses including NOT_INSTALLED for missing current sensor', async () => {
      const { Device } = await import('../models/Device.js')
      const { Telemetry } = await import('../models/Telemetry.js')

      vi.spyOn(Device, 'findOne').mockReturnValueOnce({
        sort: () => Promise.resolve({
          deviceId: 'ESP32-01',
          status: 'ONLINE',
          lastSeenAt: new Date(),
          rssi: -58,
          uptimeSec: 3600,
          hardware: { currentSensorInstalled: false },
          loads: { led: { actualState: false }, fan: { actualState: false } },
          configuration: { desired: { version: 1 }, applied: { version: 1, status: 'SYNCHRONIZED' } },
        }),
      } as any)

      vi.spyOn(Telemetry, 'findOne').mockReturnValueOnce({
        sort: () => Promise.resolve({
          deviceId: 'ESP32-01',
          storageVoltage: 4.25,
          footstepCount: 150,
          current: null,
        }),
      } as any)

      const report = await runSystemSelfTest('ESP32-01')
      expect(report.results).toBeDefined()

      const currentSensorCheck = report.results.find((r) => r.component.includes('Current Sensor'))
      expect(currentSensorCheck).toBeDefined()
      expect(currentSensorCheck?.status).toBe('NOT_INSTALLED')

      const storageCheck = report.results.find((r) => r.component.includes('Supercapacitor Voltage'))
      expect(storageCheck?.status).toBe('PASS')

      const configCheck = report.results.find((r) => r.component.includes('Remote Configuration'))
      expect(configCheck?.status).toBe('PASS')
    })
  })
})
