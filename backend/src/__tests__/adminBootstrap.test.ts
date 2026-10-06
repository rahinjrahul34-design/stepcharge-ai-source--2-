import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { config } from '../config/env.js'
import { User } from '../models/User.js'
import { ensureInitialAdminAccount } from '../services/adminBootstrap.js'

vi.mock('../config/database.js', () => ({
  isDbConnected: () => true,
  connectDatabase: vi.fn(),
  disconnectDatabase: vi.fn(),
}))

describe('Initial administrator bootstrap', () => {
  it('provisions a password-hashed admin account that can sign in', async () => {
    const email = 'admin@stepcharge.local'
    const password = 'StepChargeAdmin123!'
    const user: any = {
      _id: { toString: () => '660000000000000000000001' },
      email,
      name: 'StepCharge Administrator',
      role: 'ADMIN',
      lastLoginAt: new Date(),
      save: vi.fn().mockResolvedValue(undefined),
    }
    let created = false

    vi.spyOn(User, 'findOne').mockImplementation((() => ({
      select: vi.fn().mockResolvedValue(created ? user : null),
    })) as any)
    vi.spyOn(User, 'create').mockImplementation((async (attributes: any) => {
      Object.assign(user, attributes)
      created = true
      return user
    }) as any)

    config.initialAdminEmail = email
    config.initialAdminPassword = password
    await ensureInitialAdminAccount()

    expect(user.role).toBe('ADMIN')
    expect(user.passwordHash).not.toBe(password)
    expect(user.passwordHash).toMatch(/^[a-f0-9]+:[a-f0-9]+$/)

    const response = await request(createApp())
      .post('/api/auth/login')
      .send({ email, password })

    expect(response.status).toBe(200)
    expect(response.body.data.user.role).toBe('ADMIN')
    expect(response.headers['set-cookie']).toBeDefined()
  })
})
