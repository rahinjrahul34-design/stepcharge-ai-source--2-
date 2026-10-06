import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config/env.js'
import { User, IUser, UserRole } from '../models/User.js'
import { isDbConnected } from '../config/database.js'

export interface AuthPayload {
  userId: string
  email: string
  role: UserRole
  name: string
  googleId: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
      userDoc?: IUser
    }
  }
}

export function extractToken(req: Request): string | null {
  // Check HTTP-only cookie first
  if (req.cookies && req.cookies[config.sessionCookieName]) {
    return req.cookies[config.sessionCookieName]
  }
  // Check Authorization header as fallback
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim()
  }
  return null
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req)
  if (!token) {
    return next()
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthPayload
    req.user = decoded
    next()
  } catch {
    // Expired or invalid token, proceed unauthenticated
    next()
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req)
  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication session required. Please sign in with Google.',
      },
    })
    return
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthPayload
    req.user = decoded

    // In local development if database is offline, allow dev user through seamlessly
    if (!isDbConnected() && !config.isProd) {
      req.userDoc = {
        _id: decoded.userId,
        googleId: decoded.googleId,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=StepCharge',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      } as any
      return next()
    }

    // Verify user still exists in DB
    const userDoc = await User.findById(decoded.userId)
    if (!userDoc) {
      if (!config.isProd) {
        req.userDoc = {
          _id: decoded.userId,
          googleId: decoded.googleId,
          email: decoded.email,
          name: decoded.name,
          role: decoded.role,
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=StepCharge',
          createdAt: new Date(),
          lastLoginAt: new Date(),
        } as any
        return next()
      }
      res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The authenticated user account no longer exists.',
        },
      })
      return
    }
    req.userDoc = userDoc
    req.user.role = userDoc.role // ensure latest role is present
    next()
  } catch (err) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_SESSION',
        message: 'Your authentication session has expired or is invalid. Please sign in again.',
      },
    })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Administrator privileges are required to perform this action.',
      },
    })
    return
  }
  next()
}
