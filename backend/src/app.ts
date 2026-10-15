import express, { Express } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
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
  const allowedOrigins = [...new Set([config.frontendUrl, ...config.corsOrigins])]

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

  // Cloud & Render Health Check Endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() })
  })

  // Mount API Endpoints
  app.use('/api', routes)

  // Frontend Static Files & SPA Fallback
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const publicDir = path.resolve(currentDir, '../public')

  if (fs.existsSync(publicDir) && fs.existsSync(path.join(publicDir, 'index.html'))) {
    app.use(express.static(publicDir))
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/health') {
        return next()
      }
      res.sendFile(path.join(publicDir, 'index.html'))
    })
  } else {
    app.get('/', (_req, res) => {
      res.status(200).json({ status: 'ok', service: 'stepcharge-backend', timestamp: new Date().toISOString() })
    })
  }

  // 404 & Error Handling
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
