import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { config } from '../config/env.js'

describe('StepCharge AI API Integration Tests', () => {
  const app = createApp()
  const originalClientId = config.google.clientId
  const originalClientSecret = config.google.clientSecret
  beforeAll(() => {
    config.google.clientId = 'api-test-client.apps.googleusercontent.com'
    config.google.clientSecret = 'api-test-secret'
  })
  afterAll(() => {
    config.google.clientId = originalClientId
    config.google.clientSecret = originalClientSecret
  })

  it('GET /api/system/health returns system status', async () => {
    const res = await request(app).get('/api/system/health')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.service).toBe('stepcharge-backend')
    expect(res.body.data.database.provider).toBe('MongoDB Atlas')
  })

  it('GET /api/auth/google/url returns OAuth authorization URL', async () => {
    const res = await request(app).get('/api/auth/google/url')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.url).toContain('accounts.google.com')
  })

  it('POST /api/auth/google/token rejects empty token with 400', async () => {
    const res = await request(app).post('/api/auth/google/token').send({})
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('INVALID_TOKEN')
  })

  it('GET /api/auth/me returns 401 when no session cookie is provided', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('POST /api/devices/ESP32-01/load-command rejects unauthenticated user with 401', async () => {
    const res = await request(app)
      .post('/api/devices/ESP32-01/load-command')
      .send({ load: 'led', command: true })
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('POST /api/devices/ESP32-01/telemetry fails gracefully with 503 when MongoDB is offline', async () => {
    const res = await request(app)
      .post('/api/devices/ESP32-01/telemetry')
      .send({
        deviceId: 'ESP32-01',
        storageVoltage: 4.0,
        peakVoltage: 5.0,
        averageVoltage: 3.0,
        pulseDuration: 150,
        footstepCount: 1,
      })
    expect(res.status).toBe(503)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('DATABASE_UNAVAILABLE')
  })

  it('Returns 404 with standardized error for unknown routes', async () => {
    const res = await request(app).get('/api/non-existent-endpoint')
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
