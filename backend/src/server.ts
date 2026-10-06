import { createServer } from 'http'
import { createApp } from './app.js'
import { config } from './config/env.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { initSocketIO } from './config/socket.js'
import { ensureInitialAdminAccount } from './services/adminBootstrap.js'

async function bootstrap() {
  const app = createApp()
  const httpServer = createServer(app)

  // Initialize Socket.IO
  initSocketIO(httpServer)

  // Connect to Database
  await connectDatabase()
  await ensureInitialAdminAccount()

  // Start HTTP Server
  const server = httpServer.listen(config.port, () => {
    console.log(`====================================================`)
    console.log(`StepCharge AI Backend Server`)
    console.log(`Port:        ${config.port}`)
    console.log(`Environment: ${config.nodeEnv}`)
    console.log(`Frontend:    ${config.frontendUrl}`)
    console.log(`API Base:    http://localhost:${config.port}/api`)
    console.log(`====================================================`)
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
