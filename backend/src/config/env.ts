import dotenv from 'dotenv'
dotenv.config()

const isDevelopment = (process.env.NODE_ENV || 'development') === 'development'
const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'stepcharge_dev_secret_super_secure_key_32chars')
if (process.env.NODE_ENV === 'production' && !jwtSecret) {
  throw new Error('JWT_SECRET must be configured in production.')
}
const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase()
  || (isDevelopment ? 'admin@stepcharge.local' : '')
const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD
  || (isDevelopment ? 'StepChargeAdmin123!' : '')

if (initialAdminPassword && !initialAdminEmail) {
  throw new Error('INITIAL_ADMIN_EMAIL must be configured when INITIAL_ADMIN_PASSWORD is set.')
}
if (initialAdminPassword && initialAdminPassword.length < 8) {
  throw new Error('INITIAL_ADMIN_PASSWORD must be at least 8 characters long.')
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/stepcharge',
  jwtSecret,
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'stepcharge_session',
  sessionMaxAgeMs: parseInt(process.env.SESSION_MAX_AGE_MS || '604800000', 10), // 7 days
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
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
