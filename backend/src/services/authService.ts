import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import { Response } from 'express'
import { config } from '../config/env.js'
import { User, IUser, UserRole } from '../models/User.js'
import { AuditLog } from '../models/AuditLog.js'

function createGoogleClient(): OAuth2Client {
  return new OAuth2Client(
    config.google.clientId,
    config.google.clientSecret,
    config.google.callbackUrl,
  )
}

export interface GoogleProfile {
  googleId: string
  email: string
  name: string
  avatarUrl?: string
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(config.google.clientId && config.google.clientSecret)
}

export function requireGoogleOAuthConfigured(): void {
  if (!isGoogleOAuthConfigured()) {
    throw new Error('Google OAuth is not configured.')
  }
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  requireGoogleOAuthConfigured()
  const googleClient = createGoogleClient()
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: config.google.clientId,
  })
  const payload = ticket.getPayload()
  if (!payload || !payload.sub || !payload.email) {
    throw new Error('Invalid Google token: missing required user claims.')
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
    avatarUrl: payload.picture,
  }
}

export async function exchangeOAuthCode(code: string): Promise<GoogleProfile> {
  requireGoogleOAuthConfigured()
  const googleClient = createGoogleClient()
  const { tokens } = await googleClient.getToken(code)
  if (!tokens.id_token) {
    throw new Error('Google OAuth exchange failed to return an id_token.')
  }
  return verifyGoogleIdToken(tokens.id_token)
}

import crypto from 'crypto'

export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function generateGoogleAuthUrl(state?: string): string {
  requireGoogleOAuthConfigured()
  const googleClient = createGoogleClient()
  return googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
    state,
  })
}

export async function findOrCreateGoogleUser(
  profile: GoogleProfile,
  ip?: string,
): Promise<{ user: IUser; isNew: boolean }> {
  let user = await User.findOne({ googleId: profile.googleId })
  let isNew = false

  // Check if profile email matches configured administrator list
  const isAdminEmail = config.adminEmails.includes(profile.email.toLowerCase())

  if (!user) {
    // Check if user with same email exists
    user = await User.findOne({ email: profile.email })
    if (user) {
      // Link existing user to Google ID
      user.googleId = profile.googleId
      if (profile.avatarUrl && !user.avatarUrl) user.avatarUrl = profile.avatarUrl
      if (profile.name && !user.name) user.name = profile.name
      if (isAdminEmail && user.role !== 'ADMIN') user.role = 'ADMIN'
      user.lastLoginAt = new Date()
      await user.save()
    } else {
      // Role is USER by default; ADMIN only if explicitly in ADMIN_EMAILS
      const role: UserRole = isAdminEmail ? 'ADMIN' : 'USER'

      user = await User.create({
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl || '',
        role,
        lastLoginAt: new Date(),
      })
      isNew = true
    }
  } else {
    user.lastLoginAt = new Date()
    if (profile.name) user.name = profile.name
    if (profile.avatarUrl) user.avatarUrl = profile.avatarUrl
    if (isAdminEmail && user.role !== 'ADMIN') user.role = 'ADMIN'
    await user.save()
  }

  // Audit log
  await AuditLog.create({
    userId: user._id,
    userEmail: user.email,
    action: isNew ? 'USER_REGISTER_GOOGLE' : 'USER_LOGIN_GOOGLE',
    resource: `User:${user._id}`,
    ip,
    metadata: { role: user.role, isNew },
    timestamp: new Date(),
  }).catch((err) => console.error('[Audit] Failed to log login event:', err))

  return { user, isNew }
}

export function createSessionToken(user: IUser): string {
  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
      googleId: user.googleId,
    },
    config.jwtSecret,
    { expiresIn: '7d' },
  )
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(config.sessionCookieName, token, {
    httpOnly: true,
    secure: config.isProd, // true in HTTPS production
    sameSite: config.isProd ? 'none' : 'lax',
    maxAge: config.sessionMaxAgeMs,
    path: '/',
  })
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(config.sessionCookieName, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'lax',
    path: '/',
  })
}
