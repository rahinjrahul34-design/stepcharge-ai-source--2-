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
} from '../services/authService.js'
import { config } from '../config/env.js'
import { AuditLog } from '../models/AuditLog.js'

export async function getAuthUrl(req: Request, res: Response): Promise<void> {
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

export async function devLogin(req: Request, res: Response): Promise<void> {
  if (config.isProd) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Dev login is disabled in production.' },
    })
    return
  }

  const { email = 'developer@stepcharge.local', name = 'StepCharge Developer' } = req.body || {}
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
