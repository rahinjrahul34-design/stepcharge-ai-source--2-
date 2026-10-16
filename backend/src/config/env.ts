import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

// Resolve relative to this config file so `npm run dev` loads backend/.env
// whether the command is started from the backend folder or repository root.
const backendEnvPath = fileURLToPath(new URL('../../.env', import.meta.url))
const dotenvResult = dotenv.config({ path: backendEnvPath })
if (dotenvResult.error && (dotenvResult.error as NodeJS.ErrnoException).code !== 'ENOENT') {
  throw new Error(`Could not read backend environment file: ${dotenvResult.error.message}`)
}

const isDevelopment = (process.env.NODE_ENV || 'development') === 'development'
const configuredJwtSecret = process.env.JWT_SECRET || ''
const jwtSecretIsPlaceholder = configuredJwtSecret.includes('replace_with') || configuredJwtSecret.startsWith('your-')
const jwtSecret = jwtSecretIsPlaceholder ? '' : configuredJwtSecret
if (!jwtSecret && !isDevelopment) {
  throw new Error('JWT_SECRET must be configured outside development.')
}
if (jwtSecret && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long.')
}
const port = Number(process.env.PORT || 5000)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.')
}
let rawFrontendUrl = (
  process.env.FRONTEND_URL ||
  (isDevelopment ? 'http://localhost:5173' : 'https://stepcharge-ai-source-2.vercel.app')
).trim()
if (rawFrontendUrl.startsWith('//')) {
  rawFrontendUrl = `https:${rawFrontendUrl}`
} else if (!/^https?:\/\//i.test(rawFrontendUrl)) {
  rawFrontendUrl = `https://${rawFrontendUrl}`
}
const frontendUrl = rawFrontendUrl
try {
  new URL(frontendUrl)
} catch {
  throw new Error('FRONTEND_URL must be a valid absolute URL.')
}

const defaultCorsOrigins = isDevelopment
  ? 'http://localhost:5173,http://127.0.0.1:5173'
  : 'https://stepcharge-ai-source-2.vercel.app,https://stepcharge-ai-source-2-d634poypi-rahul-e256.vercel.app,http://localhost:5173'

const corsOrigins = (process.env.CORS_ORIGINS || defaultCorsOrigins)
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)

const defaultCallback = process.env.RENDER_EXTERNAL_URL
  ? `${process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '')}/api/auth/google/callback`
  : 'http://localhost:5000/api/auth/google/callback'

let rawGoogleCallbackUrl = (process.env.GOOGLE_CALLBACK_URL || defaultCallback).trim()
if (process.env.RENDER_EXTERNAL_URL && rawGoogleCallbackUrl.includes('localhost')) {
  rawGoogleCallbackUrl = `${process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '')}/api/auth/google/callback`
}
if (rawGoogleCallbackUrl.startsWith('//')) {
  rawGoogleCallbackUrl = `https:${rawGoogleCallbackUrl}`
} else if (!/^https?:\/\//i.test(rawGoogleCallbackUrl)) {
  rawGoogleCallbackUrl = `https://${rawGoogleCallbackUrl}`
}
const googleCallbackUrl = rawGoogleCallbackUrl
try {
  new URL(googleCallbackUrl)
} catch {
  throw new Error('GOOGLE_CALLBACK_URL must be a valid absolute URL.')
}
const configuredMongoUri = process.env.MONGODB_URI || ''
const mongoUriIsPlaceholder = configuredMongoUri.includes('<')
  || configuredMongoUri.includes('>')
  || configuredMongoUri.includes('your_')
  || configuredMongoUri.includes('<cluster>')
if (mongoUriIsPlaceholder && !isDevelopment) {
  throw new Error('MONGODB_URI still contains example placeholders. Set a real connection string in backend/.env.')
}
let mongoUri = !configuredMongoUri || mongoUriIsPlaceholder
  ? 'mongodb://127.0.0.1:27017/stepcharge'
  : configuredMongoUri

if (/^mongodb\+srv:\/\/[^/]+\/?$/.test(mongoUri)) {
  mongoUri = mongoUri.replace(/\/?$/, '/stepcharge?retryWrites=true&w=majority')
} else if (/^mongodb\+srv:\/\/[^/?]+\/\?/.test(mongoUri)) {
  mongoUri = mongoUri.replace(/\/\?/, '/stepcharge?')
}
const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase() || ''
const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || ''

if (initialAdminPassword && !initialAdminEmail) {
  throw new Error('INITIAL_ADMIN_EMAIL must be configured when INITIAL_ADMIN_PASSWORD is set.')
}
if (initialAdminPassword && initialAdminPassword.length < 8) {
  throw new Error('INITIAL_ADMIN_PASSWORD must be at least 8 characters long.')
}

export const config = {
  port,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  frontendUrl: frontendUrl.replace(/\/$/, ''),
  corsOrigins,
  mongoUri,
  jwtSecret: jwtSecret || 'stepcharge_dev_secret_super_secure_key_32chars',
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'stepcharge_session',
  sessionMaxAgeMs: parseInt(process.env.SESSION_MAX_AGE_MS || '604800000', 10), // 7 days
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: googleCallbackUrl,
  },
  passwordReset: {
    emailFrom: process.env.PASSWORD_RESET_EMAIL_FROM || '',
    resendApiKey: process.env.RESEND_API_KEY || '',
  },
  mlServiceUrl: (process.env.ML_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, ''),
  initialAdminEmail,
  initialAdminPassword,
  adminEmails: [...(process.env.ADMIN_EMAILS || process.env.INITIAL_ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean), ...(initialAdminEmail ? [initialAdminEmail] : [])],
  defaultDeviceId: process.env.DEFAULT_DEVICE_ID || 'ESP32-01',
  deviceAutoProvision: process.env.DEVICE_AUTO_PROVISION === 'true', // strictly FALSE by default
  // Hardware safety & energy constants
  supercapFarads: parseFloat(process.env.SUPERCAP_FARADS || '0.1'),
  maxStorageVoltage: parseFloat(process.env.MAX_STORAGE_VOLTAGE || '5.0'),
  warnStorageVoltage: parseFloat(process.env.WARN_STORAGE_VOLTAGE || '4.7'),
  lowStorageVoltage: parseFloat(process.env.LOW_STORAGE_VOLTAGE || '2.0'),
}
