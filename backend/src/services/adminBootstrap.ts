import crypto from 'crypto'
import { config } from '../config/env.js'
import { isDbConnected } from '../config/database.js'
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

export async function ensureInitialAdminAccount(
  credentials: { email?: string; password?: string } = {
    email: config.initialAdminEmail,
    password: config.initialAdminPassword,
  },
): Promise<void> {
  const email = credentials.email?.trim().toLowerCase()
  const password = credentials.password
  if (!email || !password || !isDbConnected()) return

  const user = await User.findOne({ email }).select('+passwordHash')
  if (!user) {
    await User.create({
      email,
      name: 'StepCharge Administrator',
      passwordHash: hashPassword(password),
      role: 'ADMIN',
      lastLoginAt: new Date(),
    })
    console.log(`[Auth] Initial admin account provisioned for ${email}.`)
    return
  }

  let changed = false
  if (user.role !== 'ADMIN') {
    user.role = 'ADMIN'
    changed = true
  }
  if (!user.passwordHash || (!config.isProd && !verifyPassword(password, user.passwordHash))) {
    user.passwordHash = hashPassword(password)
    changed = true
  }
  if (changed) {
    await user.save()
    console.log(`[Auth] Initial admin account updated for ${email}.`)
  }
}
