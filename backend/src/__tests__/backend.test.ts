import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateTelemetryPayload, calculateStoredEnergy } from '../services/telemetryService.js'
import { calculateStepEnergy, R_EQ_OHMS } from '../services/footstepService.js'
import { hashDeviceKey } from '../middlewares/deviceAuth.js'
import { resolveRangeBounds } from '../controllers/historyController.js'

describe('StepCharge AI Backend Unit Tests', () => {
  describe('Telemetry Payload Validation', () => {
    it('accepts valid telemetry packets within physical bounds', () => {
      const validPayload = {
        deviceId: 'ESP32-01',
        storageVoltage: 4.2,
        peakVoltage: 3.5,
        averageVoltage: 2.1,
        pulseDuration: 180,
        stepInterval: 1.2,
        footstepCount: 42,
        wifiRssi: -65,
        uptimeSec: 3600,
      }
      const result = validateTelemetryPayload(validPayload)
      expect(result.ok).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects packets with missing deviceId', () => {
      const payload = {
        storageVoltage: 4.2,
        peakVoltage: 3.5,
        averageVoltage: 2.1,
        pulseDuration: 180,
        footstepCount: 1,
      }
      const result = validateTelemetryPayload(payload)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain('deviceId is required')
    })

    it('rejects physically impossible voltages (> 60V)', () => {
      const payload = {
        deviceId: 'ESP32-01',
        storageVoltage: 75.0, // over 60V ceiling
        peakVoltage: 3.5,
        averageVoltage: 2.1,
        pulseDuration: 180,
        footstepCount: 1,
      }
      const result = validateTelemetryPayload(payload)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain('storageVoltage must be between 0 and 60 V')
    })

    it('rejects packets where averageVoltage exceeds peakVoltage', () => {
      const payload = {
        deviceId: 'ESP32-01',
        storageVoltage: 3.0,
        peakVoltage: 2.0,
        averageVoltage: 4.5, // impossible: avg > peak
        pulseDuration: 180,
        footstepCount: 1,
      }
      const result = validateTelemetryPayload(payload)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain('averageVoltage cannot exceed peakVoltage')
    })
  })

  describe('Physics & Energy Derivations', () => {
    it('calculates stored supercapacitor energy via E = 1/2 C V^2', () => {
      const voltage = 4.0 // 4 Volts
      const farads = 1.0 // 1 Farad
      const energy = calculateStoredEnergy(voltage, farads)
      // 0.5 * 1.0 * 16 = 8 Joules
      expect(energy).toBeCloseTo(8.0, 4)
    })

    it('calculates footstep pulse energy via E = (V_avg^2 / R_eq) * t', () => {
      const avgVolts = 2.0
      const pulseMs = 200 // 0.2 s
      const energy = calculateStepEnergy(avgVolts, pulseMs, R_EQ_OHMS)
      // (4 / 10000) * 0.2 = 0.0004 * 0.2 = 0.00008 Joules
      expect(energy).toBeCloseTo(0.00008, 6)
    })

    it('handles zero or negative voltage safely without NaN', () => {
      expect(calculateStoredEnergy(0, 1.0)).toBe(0)
      expect(calculateStoredEnergy(-2, 1.0)).toBe(0)
      expect(calculateStepEnergy(0, 100)).toBe(0)
    })
  })

  describe('Device Security & Key Hashing', () => {
    it('produces deterministic SHA-256 hashes for device API keys', () => {
      const key = 'sc_live_testkey123456789'
      const hash1 = hashDeviceKey(key)
      const hash2 = hashDeviceKey(key)
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64)
      expect(hash1).not.toBe(key)
    })
  })

  describe('History Range Bounds Calculation', () => {
    it('calculates today bounds correctly', () => {
      const { from, to } = resolveRangeBounds('today')
      expect(from.getTime()).toBeLessThan(to.getTime())
      expect(to.getTime() - from.getTime()).toBeLessThanOrEqual(864e5 + 1000)
    })

    it('calculates 7d bounds correctly (~7 days span)', () => {
      const { from, to } = resolveRangeBounds('7d')
      const diffMs = to.getTime() - from.getTime()
      const days = diffMs / 864e5
      expect(days).toBeGreaterThan(6)
      expect(days).toBeLessThanOrEqual(7)
    })

    it('resolves custom dates correctly', () => {
      const { from, to } = resolveRangeBounds('custom', '2026-01-01', '2026-01-05')
      expect(from.toISOString().slice(0, 10)).toBe('2026-01-01')
      expect(to.getTime()).toBeGreaterThan(from.getTime())
    })
  })
})
