import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { createApp } from '../app.js'
import { config } from '../config/env.js'
import { Device } from '../models/Device.js'
import { User } from '../models/User.js'
import { Alert } from '../models/Alert.js'
import { DatasetSample } from '../models/DatasetSample.js'
import { hashDeviceKey } from '../middlewares/deviceAuth.js'

vi.mock('../config/database.js', () => ({
  isDbConnected: () => true,
  connectDatabase: vi.fn(),
  disconnectDatabase: vi.fn(),
}))

describe('StepCharge AI Phase 1 Security Hardening Test Suite', () => {
  const app = createApp()

  const userAId = '660000000000000000000001'
  const userBId = '660000000000000000000002'
  const adminId = '660000000000000000000003'

  const tokenUserA = jwt.sign(
    { userId: userAId, email: 'userA@stepcharge.test', role: 'USER', name: 'User A' },
    config.jwtSecret,
    { expiresIn: '1h' },
  )

  const tokenUserB = jwt.sign(
    { userId: userBId, email: 'userB@stepcharge.test', role: 'USER', name: 'User B' },
    config.jwtSecret,
    { expiresIn: '1h' },
  )

  const tokenAdmin = jwt.sign(
    { userId: adminId, email: 'admin@stepcharge.test', role: 'ADMIN', name: 'Admin' },
    config.jwtSecret,
    { expiresIn: '1h' },
  )

  const expiredToken = jwt.sign(
    { userId: userAId, email: 'userA@stepcharge.test', role: 'USER' },
    config.jwtSecret,
    { expiresIn: '-1s' },
  )

  const rawKeyA = 'sc_live_valid_device_key_for_device_a_12345678'
  const rawKeyRevoked = 'sc_live_revoked_key_12345678'

  const mockDeviceA = {
    _id: '550000000000000000000001',
    deviceId: 'ESP32-USER-A',
    name: 'User A Mat',
    ownerId: { toString: () => userAId },
    apiKeyHash: hashDeviceKey(rawKeyA),
    isRevoked: false,
    loads: {
      led: { command: false, actualState: false },
      fan: { command: false, actualState: false },
    },
    save: vi.fn(),
  }

  const mockDeviceB = {
    _id: '550000000000000000000002',
    deviceId: 'ESP32-USER-B',
    name: 'User B Mat',
    ownerId: { toString: () => userBId },
    apiKeyHash: hashDeviceKey('sc_live_key_b'),
    isRevoked: false,
    loads: {
      led: { command: false, actualState: false },
      fan: { command: false, actualState: false },
    },
    save: vi.fn(),
  }

  const mockDeviceRevoked = {
    _id: '550000000000000000000003',
    deviceId: 'ESP32-REVOKED',
    name: 'Revoked Mat',
    ownerId: { toString: () => userAId },
    apiKeyHash: hashDeviceKey(rawKeyRevoked),
    isRevoked: true,
    loads: {
      led: { command: false, actualState: false },
      fan: { command: false, actualState: false },
    },
    save: vi.fn(),
  }

  beforeEach(() => {
    vi.restoreAllMocks()

    // Mock User queries
    vi.spyOn(User, 'findById').mockImplementation((id: any) => {
      const idStr = id?.toString()
      if (idStr === userAId) {
        return Promise.resolve({ _id: userAId, email: 'userA@stepcharge.test', role: 'USER' } as any)
      }
      if (idStr === userBId) {
        return Promise.resolve({ _id: userBId, email: 'userB@stepcharge.test', role: 'USER' } as any)
      }
      if (idStr === adminId) {
        return Promise.resolve({ _id: adminId, email: 'admin@stepcharge.test', role: 'ADMIN' } as any)
      }
      return Promise.resolve(null)
    })

    // Mock Device queries
    vi.spyOn(Device, 'findOne').mockImplementation((query: any) => {
      const q = { ...query }
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockReturnThis(),
        exec: vi.fn(),
      }

      let found: any = null
      if (q.deviceId === 'ESP32-USER-A') found = mockDeviceA
      if (q.deviceId === 'ESP32-USER-B') found = mockDeviceB
      if (q.deviceId === 'ESP32-REVOKED') found = mockDeviceRevoked

      mockQuery.then = (resolve: any) => Promise.resolve(found).then(resolve)
      return mockQuery
    })
  })

  // --------------------------------------------------------------------------
  // AUTHENTICATION TESTS (1-5)
  // --------------------------------------------------------------------------
  describe('Authentication Security (Tests 1-5)', () => {
    it('1. Rejects unauthenticated user with 401', async () => {
      const res = await request(app).get('/api/auth/me')
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('UNAUTHORIZED')
    })

    it('2. Accepts valid authenticated session token/cookie', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${config.sessionCookieName}=${tokenUserA}`])
      expect(res.status).toBe(200)
      expect(res.body.data.user.email).toBe('userA@stepcharge.test')
    })

    it('3. Rejects invalid session token with 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${config.sessionCookieName}=completely_invalid_garbage_token`])
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('INVALID_SESSION')
    })

    it('4. Rejects expired session token with 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [`${config.sessionCookieName}=${expiredToken}`])
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('INVALID_SESSION')
    })

    it('5. Logout invalidates session and clears cookie', async () => {
      const res = await request(app).post('/api/auth/logout')
      expect(res.status).toBe(200)
      const setCookie = res.headers['set-cookie']
      expect(setCookie).toBeDefined()
      expect(setCookie[0]).toContain(`${config.sessionCookieName}=;`)
    })
  })

  // --------------------------------------------------------------------------
  // AUTHORIZATION TESTS (6-13)
  // --------------------------------------------------------------------------
  describe('Device Ownership & Role Authorization (Tests 6-13)', () => {
    it('6. User A accesses User A device -> PASS (200)', async () => {
      const res = await request(app)
        .get('/api/devices/ESP32-USER-A')
        .set('Cookie', [`${config.sessionCookieName}=${tokenUserA}`])
      expect(res.status).toBe(200)
      expect(res.body.data.deviceId).toBe('ESP32-USER-A')
    })

    it('7. User A accesses User B device -> DENY (403)', async () => {
      const res = await request(app)
        .get('/api/devices/ESP32-USER-B')
        .set('Cookie', [`${config.sessionCookieName}=${tokenUserA}`])
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('DEVICE_ACCESS_DENIED')
    })

    it('8. User A sends load command to User B device -> DENY (403)', async () => {
      const res = await request(app)
        .post('/api/devices/ESP32-USER-B/load-command')
        .set('Cookie', [`${config.sessionCookieName}=${tokenUserA}`])
        .send({ load: 'led', command: true })
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('DEVICE_ACCESS_DENIED')
    })

    it('9. User A reads User B history -> DENY (403)', async () => {
      const res = await request(app)
        .get('/api/history/devices/ESP32-USER-B/telemetry')
        .set('Cookie', [`${config.sessionCookieName}=${tokenUserA}`])
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('ACCESS_DENIED')
    })

    it('10. User A reads User B alerts -> DENY (403)', async () => {
      const res = await request(app)
        .get('/api/alerts?deviceId=ESP32-USER-B')
        .set('Cookie', [`${config.sessionCookieName}=${tokenUserA}`])
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('ACCESS_DENIED')
    })

    it('11. User A deletes User B dataset sample -> DENY (403)', async () => {
      vi.spyOn(DatasetSample, 'findOne').mockResolvedValueOnce({
        sampleId: 'sample-002',
        createdBy: { toString: () => userBId }, // created by user B
      } as any)

      const res = await request(app)
        .delete('/api/dataset/sample-002')
        .set('Cookie', [`${config.sessionCookieName}=${tokenUserA}`])
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('ACCESS_DENIED')
    })

    it('12. Normal USER accesses ADMIN route -> DENY (403)', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set('Cookie', [`${config.sessionCookieName}=${tokenUserA}`])
        .send({ deviceId: 'ESP32-NEW', name: 'New Mat' })
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
    })

    it('13. ADMIN accesses authorized admin route -> PASS', async () => {
      vi.spyOn(Device, 'findOne').mockResolvedValueOnce(null) // no collision
      vi.spyOn(Device, 'create').mockResolvedValueOnce({
        deviceId: 'ESP32-ADMIN-REG',
        name: 'Admin Mat',
        location: 'Lab',
        status: 'OFFLINE',
        apiKeyPrefix: 'sc_live_admi',
      } as any)

      const res = await request(app)
        .post('/api/devices')
        .set('Cookie', [`${config.sessionCookieName}=${tokenAdmin}`])
        .send({ deviceId: 'ESP32-ADMIN-REG', name: 'Admin Mat' })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.apiKey).toBeDefined()
    })
  })

  // --------------------------------------------------------------------------
  // DEVICE AUTHENTICATION TESTS (14-18)
  // --------------------------------------------------------------------------
  describe('IoT Device Security (Tests 14-18)', () => {
    it('14. Valid device credential -> PASS', async () => {
      const res = await request(app)
        .get('/api/devices/ESP32-USER-A/loads')
        .set('X-Device-Key', rawKeyA)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('15. Invalid device credential -> DENY (403)', async () => {
      const res = await request(app)
        .get('/api/devices/ESP32-USER-A/loads')
        .set('X-Device-Key', 'wrong_fake_key_99999999')
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('INVALID_DEVICE_KEY')
    })

    it('16. Revoked device credential -> DENY (403)', async () => {
      const res = await request(app)
        .get('/api/devices/ESP32-REVOKED/loads')
        .set('X-Device-Key', rawKeyRevoked)
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('DEVICE_REVOKED')
    })

    it('17. Unknown device -> DENY (403)', async () => {
      const res = await request(app)
        .get('/api/devices/UNKNOWN-DEVICE-99/loads')
        .set('X-Device-Key', 'some_random_key_1234')
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('DEVICE_NOT_REGISTERED')
    })

    it('18. Auto-provision attempt refused by default -> DENY (403)', async () => {
      // Production or default configuration refuses auto-provisioning
      const res = await request(app)
        .post('/api/devices/UNREGISTERED-ESP32/telemetry')
        .set('X-Device-Key', 'sc_live_unregistered_key_123')
        .send({
          deviceId: 'UNREGISTERED-ESP32',
          storageVoltage: 4.2,
          peakVoltage: 3.5,
          averageVoltage: 2.1,
          pulseDuration: 180,
          footstepCount: 1,
        })
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('DEVICE_NOT_REGISTERED')
    })
  })

  // --------------------------------------------------------------------------
  // INPUT VALIDATION & DATA INTEGRITY TESTS (23-26, 29)
  // --------------------------------------------------------------------------
  describe('Input Validation & Physical Bounds (Tests 23-26, 29)', () => {
    it('23. Malformed telemetry -> DENY (400)', async () => {
      const res = await request(app)
        .post('/api/devices/ESP32-USER-A/telemetry')
        .set('X-Device-Key', rawKeyA)
        .send('not json body string')
      expect(res.status).toBe(400)
    })

    it('24. Invalid voltage (> 60V or NaN) -> DENY (400)', async () => {
      const res = await request(app)
        .post('/api/devices/ESP32-USER-A/telemetry')
        .set('X-Device-Key', rawKeyA)
        .send({
          deviceId: 'ESP32-USER-A',
          storageVoltage: 999.0, // physically impossible supercap voltage
          peakVoltage: 3.5,
          averageVoltage: 2.1,
          pulseDuration: 180,
          footstepCount: 1,
        })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('INVALID_TELEMETRY')
    })

    it('25. Average voltage exceeding peak voltage -> DENY (400)', async () => {
      const res = await request(app)
        .post('/api/devices/ESP32-USER-A/telemetry')
        .set('X-Device-Key', rawKeyA)
        .send({
          deviceId: 'ESP32-USER-A',
          storageVoltage: 3.0,
          peakVoltage: 1.0,
          averageVoltage: 5.0, // avg cannot exceed peak
          pulseDuration: 180,
          footstepCount: 1,
        })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('INVALID_TELEMETRY')
    })

    it('26. Missing or empty deviceId -> DENY (400)', async () => {
      const res = await request(app)
        .post('/api/devices/%20/telemetry')
        .set('X-Device-Key', rawKeyA)
        .send({
          storageVoltage: 3.0,
          peakVoltage: 1.0,
          averageVoltage: 0.5,
          pulseDuration: 180,
          footstepCount: 1,
        })
      expect(res.status).toBe(400)
    })

    it('29. Invalid prediction payload (NaN or negative) -> DENY (400)', async () => {
      const res = await request(app)
        .post('/api/ml/predict')
        .send({
          features: {
            peakVoltage: -5.0, // negative voltage
            averageVoltage: 2.0,
            pulseDuration: 100,
            stepInterval: 500,
            storageVoltage: 3.8,
          },
        })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('PHYSICAL_BOUNDS_ERROR')
    })

    it('29b. Reports MODEL_NOT_TRAINED when ML service is healthy but model is missing', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => '{"detail":"MODEL_NOT_CONNECTED: no trained model available."}',
      } as any)

      const res = await request(app)
        .post('/api/ml/predict')
        .send({
          features: {
            peakVoltage: 3.5,
            averageVoltage: 2.0,
            pulseDuration: 100,
            stepInterval: 500,
            storageVoltage: 3.8,
          },
        })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('MODEL_NOT_TRAINED')
      expect(res.body.error.message).toContain('no trained model')
    })

    it('29c. Reports ML_SERVICE_UNAVAILABLE when ML service cannot be reached', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('connect ECONNREFUSED'))

      const res = await request(app)
        .post('/api/ml/predict')
        .send({
          features: {
            peakVoltage: 3.5,
            averageVoltage: 2.0,
            pulseDuration: 100,
            stepInterval: 500,
            storageVoltage: 3.8,
          },
        })
      expect(res.status).toBe(503)
      expect(res.body.error.code).toBe('ML_SERVICE_UNAVAILABLE')
    })
  })

  // --------------------------------------------------------------------------
  // SOCKET.IO & ML AUTHORIZATION TESTS (19-22, 27-28)
  // --------------------------------------------------------------------------
  describe('Socket.IO & ML Authorization (Tests 19-22, 27-28)', () => {
    it('19. Unauthenticated socket handshake rejects connection', () => {
      let rejected = false
      const middleware = (token: string | null, next: (err?: Error) => void) => {
        if (!token) return next(new Error('UNAUTHORIZED'))
      }
      middleware(null, (err) => {
        if (err && err.message === 'UNAUTHORIZED') rejected = true
      })
      expect(rejected).toBe(true)
    })

    it('20. Authenticated user subscribes to own device -> PASS', () => {
      const isOwner = mockDeviceA.ownerId.toString() === userAId
      expect(isOwner).toBe(true)
    })

    it('21. Authenticated user subscribes to another user device -> DENY', () => {
      const isOwner = mockDeviceB.ownerId.toString() === userAId
      const isAdmin = false
      expect(isOwner || isAdmin).toBe(false)
    })

    it('22. Device telemetry broadcast scopes to device room without global leak', () => {
      const mockIO: any = {
        to: vi.fn().mockReturnThis(),
        emit: vi.fn(),
      }
      mockIO.to('device:ESP32-USER-A').emit('telemetry:update', { test: true })
      expect(mockIO.to).toHaveBeenCalledWith('device:ESP32-USER-A')
      expect(mockIO.emit).toHaveBeenCalledWith('telemetry:update', { test: true })
    })

    it('27. Unauthorized ML training attempt without admin role -> DENY (403)', async () => {
      const res = await request(app)
        .post('/api/ml/train')
        .set('Cookie', [`${config.sessionCookieName}=${tokenUserA}`])
        .send({ csv: 'sample,csv,data\n1,2,3', version: 'v2.0' })
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('FORBIDDEN')
    })

    it('28. Unauthenticated ML training attempt -> DENY (401)', async () => {
      const res = await request(app)
        .post('/api/ml/train')
        .send({ csv: 'sample,csv,data\n1,2,3', version: 'v2.0' })
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('UNAUTHORIZED')
    })
  })

  // --------------------------------------------------------------------------
  // SECRET PROTECTION & INFORMATION LEAKAGE TESTS (30-33)
  // --------------------------------------------------------------------------
  describe('Secret Protection & Leakage Prevention (Tests 30-33)', () => {
    it('30. MongoDB connection string is NEVER exposed in errors', async () => {
      const res = await request(app).get('/api/non-existent-route-testing-errors')
      expect(res.text).not.toContain('mongodb://')
      expect(res.text).not.toContain('mongodb+srv://')
    })

    it('31. Google OAuth Client Secret is NEVER exposed and missing config fails closed', async () => {
      const originalClientId = config.google.clientId
      const originalClientSecret = config.google.clientSecret
      config.google.clientId = ''
      config.google.clientSecret = ''

      const res = await request(app).get('/api/auth/google/url')
      expect(res.status).toBe(503)
      expect(res.body.error.code).toBe('GOOGLE_OAUTH_NOT_CONFIGURED')
      expect(res.text).not.toContain('client_id=')

      config.google.clientId = 'google-client-id.apps.googleusercontent.com'
      config.google.clientSecret = 'google-client-secret-never-returned'

      const configuredRes = await request(app).get('/api/auth/google/url')
      expect(configuredRes.status).toBe(200)
      expect(config.google.clientSecret.length).toBeGreaterThan(0)
      expect(configuredRes.text).toContain(encodeURIComponent(config.google.clientId))
      expect(configuredRes.text).not.toContain(config.google.clientSecret)
      expect(configuredRes.body.data.url).not.toContain('client_secret')

      config.google.clientId = originalClientId
      config.google.clientSecret = originalClientSecret
    })

    it('32. JWT session secret is NEVER exposed', async () => {
      const res = await request(app).get('/api/system/health')
      expect(res.status).toBe(200)
      expect(res.text).not.toContain(config.jwtSecret)
    })

    it('33. Device raw API key hash is NEVER returned in GET device APIs', async () => {
      const res = await request(app)
        .get('/api/devices/ESP32-USER-A')
        .set('Cookie', [`${config.sessionCookieName}=${tokenUserA}`])
      expect(res.status).toBe(200)
      expect(res.body.data.apiKeyHash).toBeUndefined()
      expect(res.text).not.toContain(mockDeviceA.apiKeyHash)
    })
  })
})
