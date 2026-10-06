import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { User } from '../models/User.js'

vi.mock('../config/database.js', () => ({
  isDbConnected: () => true,
  connectDatabase: vi.fn(),
  disconnectDatabase: vi.fn(),
}))

describe('Email/Password & Password Reset Flow Tests', () => {
  const app = createApp()

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects registration with short password (< 8 chars)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test@stepcharge.ai',
      password: 'short',
      name: 'Test User',
    })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('INVALID_PASSWORD')
  })

  it('successfully registers new user with hashed password and session cookie', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue(null as any)
    const mockUser = {
      _id: '660000000000000000000099',
      email: 'newuser@stepcharge.ai',
      name: 'New User',
      avatarUrl: '',
      role: 'USER',
      lastLoginAt: new Date(),
    }
    vi.spyOn(User, 'create').mockResolvedValue(mockUser as any)

    const res = await request(app).post('/api/auth/register').send({
      email: 'newuser@stepcharge.ai',
      password: 'SecurePassword123!',
      name: 'New User',
    })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.user.email).toBe('newuser@stepcharge.ai')
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('rejects login with invalid email/password', async () => {
    vi.spyOn(User, 'findOne').mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    } as any)

    const res = await request(app).post('/api/auth/login').send({
      email: 'unknown@stepcharge.ai',
      password: 'Password123!',
    })

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('AUTH_FAILED')
  })

  it('forgot-password returns safe generic message and sets token hash if user exists', async () => {
    const saveMock = vi.fn().mockResolvedValue(true)
    const mockUserDoc = {
      email: 'forgot@stepcharge.ai',
      save: saveMock,
    }
    vi.spyOn(User, 'findOne').mockResolvedValue(mockUserDoc as any)

    const res = await request(app).post('/api/auth/forgot-password').send({
      email: 'forgot@stepcharge.ai',
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.message).toBe('If an account exists for this email, a password reset link has been sent.')
    expect(saveMock).toHaveBeenCalled()
    expect(mockUserDoc).toHaveProperty('resetPasswordTokenHash')
    expect(mockUserDoc).toHaveProperty('resetPasswordExpiresAt')
  })

  it('reset-password rejects invalid token', async () => {
    vi.spyOn(User, 'findOne').mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    } as any)

    const res = await request(app).post('/api/auth/reset-password').send({
      token: 'invalid_token_123',
      newPassword: 'BrandNewSecurePassword123!',
    })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN')
  })

  it('reset-password updates password and clears reset token (one-time use)', async () => {
    const saveMock = vi.fn().mockResolvedValue(true)
    const mockUserDoc: any = {
      _id: '660000000000000000000099',
      email: 'reset@stepcharge.ai',
      name: 'Reset User',
      role: 'USER',
      resetPasswordTokenHash: 'mockHash',
      resetPasswordExpiresAt: new Date(Date.now() + 100000),
      save: saveMock,
    }
    vi.spyOn(User, 'findOne').mockReturnValue({
      select: vi.fn().mockResolvedValue(mockUserDoc),
    } as any)

    const res = await request(app).post('/api/auth/reset-password').send({
      token: 'valid_mock_token',
      newPassword: 'BrandNewSecurePassword123!',
    })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(saveMock).toHaveBeenCalled()
    expect(mockUserDoc.resetPasswordTokenHash).toBeUndefined()
    expect(mockUserDoc.resetPasswordExpiresAt).toBeUndefined()
    expect(res.headers['set-cookie']).toBeDefined()
  })
})
