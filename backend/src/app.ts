import express, { Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { config } from './config/env.js'
import routes from './routes/index.js'
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js'
import { standardLimiter } from './middlewares/rateLimiter.js'
import { optionalAuth } from './middlewares/auth.js'

export function createApp(): Express {
  const app = express()

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: config.isProd ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  )

  // CORS Configuration
  const allowedOrigins = [
    config.frontendUrl,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or ESP32)
        if (!origin) return callback(null, true)
        if (allowedOrigins.includes(origin)) {
          return callback(null, true)
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`))
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Key', 'X-Device-Id'],
    }),
  )

  // Cookie & Body Parsing
  app.use(cookieParser())
  app.use(express.json({ limit: '2mb' }))
  app.use(express.urlencoded({ extended: true, limit: '2mb' }))

  // Global Rate Limiting
  app.use(standardLimiter)

  // Optional authentication hydration for user state
  app.use(optionalAuth)

  // Mount API Endpoints
  app.use('/api', routes)

  // 404 & Error Handling
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
