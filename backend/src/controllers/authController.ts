import { Request, Response } from 'express'
import {
  generateGoogleAuthUrl,
  exchangeOAuthCode,
  verifyGoogleIdToken,
  findOrCreateGoogleUser,
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  generateOAuthState,
  isGoogleOAuthConfigured,
} from '../services/authService.js'
import { config } from '../config/env.js'
import { AuditLog } from '../models/AuditLog.js'
import { isDbConnected } from '../config/database.js'

export async function getAuthUrl(req: Request, res: Response): Promise<void> {
  if (!isGoogleOAuthConfigured()) {
    res.status(503).json({
      success: false,
      error: {
        code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
        message: 'Google OAuth is not configured.',
      },
    })
    return
  }

  const state = generateOAuthState()

  // Store CSRF state in temporary HttpOnly cookie
  res.cookie('stepcharge_oauth_state', state, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: '/',
  })

  const url = generateGoogleAuthUrl(state)
  res.json({ success: true, data: { url } })
}

export async function handleGoogleCallback(req: Request, res: Response): Promise<void> {
  if (!isGoogleOAuthConfigured()) {
    res.redirect(`${config.frontendUrl}/?auth_error=oauth_not_configured`)
    return
  }

  const code = req.query.code as string
  const returnedState = req.query.state as string | undefined
  const savedState = req.cookies?.stepcharge_oauth_state

  // Clear temporary state cookie
  res.clearCookie('stepcharge_oauth_state', { path: '/' })

  if (!code) {
    res.redirect(`${config.frontendUrl}/?auth_error=missing_code`)
    return
  }

  // Strict CSRF verification
  if (!returnedState || !savedState || returnedState !== savedState) {
    console.warn('[Google OAuth] CSRF State mismatch or missing state parameter.')
    res.redirect(`${config.frontendUrl}/?auth_error=oauth_csrf_invalid`)
    return
  }

  try {
    const profile = await exchangeOAuthCode(code)
    const { user } = await findOrCreateGoogleUser(profile, req.ip)
    const token = createSessionToken(user)
    setSessionCookie(res, token)
    res.redirect(`${config.frontendUrl}/`)
  } catch (error) {
    console.error('[Google OAuth] Callback error:', error)
    res.redirect(`${config.frontendUrl}/?auth_error=oauth_failed`)
  }
}

export async function loginWithGoogleIdToken(req: Request, res: Response): Promise<void> {
  if (!isGoogleOAuthConfigured()) {
    res.status(503).json({
      success: false,
      error: {
        code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
        message: 'Google OAuth is not configured.',
      },
    })
    return
  }

  const { idToken } = req.body
  if (!idToken || typeof idToken !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Google idToken is required in request body.' },
    })
    return
  }

  try {
    const profile = await verifyGoogleIdToken(idToken)
    const { user } = await findOrCreateGoogleUser(profile, req.ip)
    const sessionToken = createSessionToken(user)
    setSessionCookie(res, sessionToken)

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          googleId: user.googleId,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
          lastLoginAt: user.lastLoginAt,
        },
      },
    })
  } catch (error) {
    console.error('[Google ID Token] Login error:', error)
    res.status(401).json({
      success: false,
      error: {
        code: 'GOOGLE_AUTH_FAILED',
        message: error instanceof Error ? error.message : 'Google authentication failed.',
      },
    })
  }
}

export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  if (!req.user || !req.userDoc) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'No active session.' },
    })
    return
  }

  res.json({
    success: true,
    data: {
      user: {
        id: req.userDoc._id,
        googleId: req.userDoc.googleId,
        email: req.userDoc.email,
        name: req.userDoc.name,
        avatarUrl: req.userDoc.avatarUrl,
        role: req.userDoc.role,
        lastLoginAt: req.userDoc.lastLoginAt,
        createdAt: req.userDoc.createdAt,
      },
    },
  })
}

export async function logout(req: Request, res: Response): Promise<void> {
  if (req.user) {
    await AuditLog.create({
      userId: req.user.userId,
      userEmail: req.user.email,
      action: 'USER_LOGOUT',
      resource: `User:${req.user.userId}`,
      ip: req.ip,
      timestamp: new Date(),
    }).catch((err) => console.error('[Audit] Failed to log logout:', err))
  }

  clearSessionCookie(res)
  res.json({
    success: true,
    data: { message: 'Logged out successfully.' },
  })
}

import crypto from 'crypto'
import { User } from '../models/User.js'

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHash] = storedHash.split(':')
  if (!salt || !originalHash) return false
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'))
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function registerWithEmail(req: Request, res: Response): Promise<void> {
  const { email, password, name } = req.body || {}
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ success: false, error: { code: 'INVALID_EMAIL', message: 'A valid email address is required.' } })
    return
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Password must be at least 8 characters long.' } })
    return
  }
  if (!isDbConnected()) {
    res.status(503).json({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Database connection is currently unavailable.' } })
    return
  }
  const cleanEmail = email.toLowerCase().trim()
  const cleanName = typeof name === 'string' && name.trim() ? name.trim() : cleanEmail.split('@')[0]

  try {
    const existing = await User.findOne({ email: cleanEmail })
    if (existing) {
      res.status(400).json({ success: false, error: { code: 'EMAIL_EXISTS', message: 'An account with this email address already exists.' } })
      return
    }

    const user = await User.create({
      email: cleanEmail,
      name: cleanName,
      passwordHash: hashPassword(password),
      role: 'USER',
      lastLoginAt: new Date(),
    })

    const token = createSessionToken(user)
    setSessionCookie(res, token)

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
          lastLoginAt: user.lastLoginAt,
        },
      },
    })
  } catch (error) {
    console.error('[Auth] Registration error:', error)
    res.status(500).json({ success: false, error: { code: 'REGISTRATION_FAILED', message: 'Unable to create account. Please try again.' } })
  }
}

export async function loginWithEmail(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body || {}
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Email and password are required.' } })
    return
  }
  if (!isDbConnected()) {
    res.status(503).json({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Database connection is currently unavailable.' } })
    return
  }
  const cleanEmail = email.toLowerCase().trim()

  try {
    const user = await User.findOne({ email: cleanEmail }).select('+passwordHash')
    if (!user || !user.passwordHash) {
      res.status(401).json({ success: false, error: { code: 'AUTH_FAILED', message: 'Invalid email or password.' } })
      return
    }

    const isValid = verifyPassword(password, user.passwordHash)
    if (!isValid) {
      res.status(401).json({ success: false, error: { code: 'AUTH_FAILED', message: 'Invalid email or password.' } })
      return
    }

    user.lastLoginAt = new Date()
    await user.save()

    const token = createSessionToken(user)
    setSessionCookie(res, token)

    res.json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
          lastLoginAt: user.lastLoginAt,
        },
      },
    })
  } catch (error) {
    console.error('[Auth] Email login error:', error)
    res.status(500).json({ success: false, error: { code: 'LOGIN_FAILED', message: 'Authentication failed. Please try again.' } })
  }
}

export async function requestPasswordReset(req: Request, res: Response): Promise<void> {
  const { email } = req.body || {}
  const genericResponse = {
    success: true,
    data: { message: 'If an account exists for this email, a password reset link has been sent.' },
  }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.json(genericResponse)
    return
  }

  if (!isDbConnected()) {
    res.status(503).json({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Database connection is currently unavailable.' } })
    return
  }

  const cleanEmail = email.toLowerCase().trim()
  try {
    const user = await User.findOne({ email: cleanEmail })
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex')
      user.resetPasswordTokenHash = hashToken(rawToken)
      user.resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      await user.save()
    }
    // Return standard security response (never leak existence)
    res.json(genericResponse)
  } catch (error) {
    console.error('[Auth] Forgot password error:', error)
    res.json(genericResponse)
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = req.body || {}
  if (!token || typeof token !== 'string' || !newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_RESET_REQUEST', message: 'Valid token and new password (min 8 chars) are required.' },
    })
    return
  }

  if (!isDbConnected()) {
    res.status(503).json({ success: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Database connection is currently unavailable.' } })
    return
  }

  try {
    const hashed = hashToken(token)
    const user = await User.findOne({
      resetPasswordTokenHash: hashed,
      resetPasswordExpiresAt: { $gt: new Date() },
    }).select('+resetPasswordTokenHash +resetPasswordExpiresAt')

    if (!user) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_OR_EXPIRED_TOKEN', message: 'Invalid or expired password reset token.' },
      })
      return
    }

    user.passwordHash = hashPassword(newPassword)
    user.resetPasswordTokenHash = undefined
    user.resetPasswordExpiresAt = undefined
    user.lastLoginAt = new Date()
    await user.save()

    const sessionToken = createSessionToken(user)
    setSessionCookie(res, sessionToken)

    res.json({
      success: true,
      data: {
        message: 'Password reset successfully.',
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
        },
      },
    })
  } catch (error) {
    console.error('[Auth] Reset password error:', error)
    res.status(500).json({ success: false, error: { code: 'RESET_FAILED', message: 'Unable to reset password.' } })
  }
}

export async function devLogin(req: Request, res: Response): Promise<void> {
  if (config.isProd) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Dev login is disabled in production.' },
    })
    return
  }

  const { email = 'developer@stepcharge.local', name = 'StepCharge Developer' } = req.body || {}

  if (!isDbConnected()) {
    const mockUser: any = {
      _id: '65f000000000000000000001',
      googleId: 'dev_user_local_01',
      email: typeof email === 'string' ? email : 'developer@stepcharge.local',
      name: typeof name === 'string' ? name : 'StepCharge Developer',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=StepCharge',
      role: 'ADMIN',
      lastLoginAt: new Date(),
    }
    const token = createSessionToken(mockUser)
    setSessionCookie(res, token)
    res.json({
      success: true,
      data: {
        user: {
          id: mockUser._id,
          googleId: mockUser.googleId,
          email: mockUser.email,
          name: mockUser.name,
          avatarUrl: mockUser.avatarUrl,
          role: mockUser.role,
          lastLoginAt: mockUser.lastLoginAt,
        },
      },
    })
    return
  }

  const { user } = await findOrCreateGoogleUser(
    {
      googleId: 'dev_user_local_01',
      email: typeof email === 'string' ? email : 'developer@stepcharge.local',
      name: typeof name === 'string' ? name : 'StepCharge Developer',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=StepCharge',
    },
    req.ip,
  )

  const token = createSessionToken(user)
  setSessionCookie(res, token)

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        googleId: user.googleId,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
      },
    },
  })
}
