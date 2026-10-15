import { createServer } from 'http'
import { createApp } from './app.js'
import { config } from './config/env.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { initSocketIO } from './config/socket.js'
import { ensureInitialAdminAccount } from './services/adminBootstrap.js'

async function bootstrap() {
  console.log(`[Config] Environment file: backend/.env (${config.nodeEnv})`)
  if (config.mongoUri.startsWith('mongodb://127.0.0.1') && process.env.MONGODB_URI) {
    console.warn('[Config] MONGODB_URI is a template value; using local MongoDB at 127.0.0.1:27017 for development.')
  }
  const app = createApp()
  const httpServer = createServer(app)

  // Initialize Socket.IO
  initSocketIO(httpServer)

  // Connect to Database
  await connectDatabase()
  await ensureInitialAdminAccount()

  // Start HTTP Server (bind explicitly to 0.0.0.0 for Render / cloud containers)
  const server = httpServer.listen(config.port, '0.0.0.0', () => {
    console.log(`====================================================`)
    console.log(`StepCharge AI Backend Server`)
    console.log(`Port:        ${config.port}`)
    console.log(`Environment: ${config.nodeEnv}`)
    console.log(`Frontend:    ${config.frontendUrl}`)
    console.log(`API Base:    http://0.0.0.0:${config.port}/api`)
    console.log(`====================================================`)
  })

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Startup] Port ${config.port} is already in use. Stop the existing backend process or set a different PORT in backend/.env.`)
      process.exit(1)
    }
    console.error('[Startup] HTTP server failed:', err.message)
    process.exit(1)
  })

  // Graceful Shutdown
  const shutdown = async (signal: string) => {
    console.log(`[Shutdown] Received ${signal}. Closing gracefully...`)
    server.close(async () => {
      await disconnectDatabase()
      console.log('[Shutdown] Server closed cleanly.')
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal startup error:', err)
  process.exit(1)
})
