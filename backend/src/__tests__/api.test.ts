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

  it('POST /api/auth/register validates required fields and password length', async () => {
    const resShort = await request(app).post('/api/auth/register').send({
      email: 'newuser@stepcharge.test',
      password: '123',
    })
    expect(resShort.status).toBe(400)
    expect(resShort.body.error.code).toBe('INVALID_PASSWORD')

    const resInvalidEmail = await request(app).post('/api/auth/register').send({
      email: 'not-an-email',
      password: 'validPassword123',
    })
    expect(resInvalidEmail.status).toBe(400)
    expect(resInvalidEmail.error).toBeDefined()
  })

  it('POST /api/auth/login validates credentials and handles offline database gracefully', async () => {
    const resMissing = await request(app).post('/api/auth/login').send({})
    expect(resMissing.status).toBe(400)
    expect(resMissing.body.error.code).toBe('INVALID_CREDENTIALS')

    const res = await request(app).post('/api/auth/login').send({
      email: 'nonexistent@stepcharge.test',
      password: 'wrongPassword123',
    })
    expect([401, 503]).toContain(res.status)
  })

  it('POST /api/auth/forgot-password returns secure generic response on invalid input or offline db', async () => {
    const resInvalid = await request(app).post('/api/auth/forgot-password').send({
      email: 'invalid-email',
    })
    expect(resInvalid.status).toBe(200)
    expect(resInvalid.body.success).toBe(true)
    expect(resInvalid.body.data.message).toContain('If an account exists for this email')

    const res = await request(app).post('/api/auth/forgot-password').send({
      email: 'test@stepcharge.test',
    })
    expect([200, 503]).toContain(res.status)
  })

  it('POST /api/auth/reset-password rejects invalid inputs with 400 or reports 503 when offline', async () => {
    const resShort = await request(app).post('/api/auth/reset-password').send({
      token: 'fake-token-that-does-not-exist',
      newPassword: 'short',
    })
    expect(resShort.status).toBe(400)
    expect(resShort.body.error.code).toBe('INVALID_RESET_REQUEST')

    const res = await request(app).post('/api/auth/reset-password').send({
      token: 'fake-token-that-does-not-exist',
      newPassword: 'newValidPassword123',
    })
    expect([400, 503]).toContain(res.status)
  })

  it('PATCH /api/alerts/:alertId/read requires authentication (401)', async () => {
    const res = await request(app).patch('/api/alerts/507f1f77bcf86cd799439011/read')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('POST /api/alerts/read-all requires authentication (401)', async () => {
    const res = await request(app).post('/api/alerts/read-all')
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })

  it('Returns 404 with standardized error for unknown routes', async () => {
    const res = await request(app).get('/api/non-existent-endpoint')
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
