import rateLimit from 'express-rate-limit'

export const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP. Please try again after 15 minutes.',
    },
  },
})

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please wait a few minutes before trying again.',
    },
  },
})

export const telemetryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 5 packets/sec per IP max
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TELEMETRY_RATE_LIMIT_EXCEEDED',
      message: 'Device telemetry rate limit exceeded.',
    },
  },
})

export const mlPredictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 2 predictions per sec max
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'ML_RATE_LIMIT_EXCEEDED',
      message: 'Too many ML prediction requests. Please throttle your client.',
    },
  },
})

export const mlTrainLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 6, // max 6 training jobs per 15 min window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TRAINING_RATE_LIMIT_EXCEEDED',
      message: 'Model training rate limit exceeded. Please wait before starting another training run.',
    },
  },
})

