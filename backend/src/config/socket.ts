import { Server as HttpServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { config } from './env.js'
import { AuthPayload } from '../middlewares/auth.js'
import { Device } from '../models/Device.js'

let io: SocketIOServer | null = null

export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [config.frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST'],
    },
  })

  // Phase 7: Authenticate Socket.IO connection via session cookie or handshake auth token
  io.use((socket: Socket, next) => {
    let token: string | null = null

    // 1. Check HTTP-only session cookie
    const cookieHeader = socket.request.headers.cookie
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${config.sessionCookieName}=([^;]+)`))
      if (match) {
        token = decodeURIComponent(match[1])
      }
    }

    // 2. Check handshake auth token as fallback
    if (!token && socket.handshake.auth && typeof socket.handshake.auth.token === 'string') {
      token = socket.handshake.auth.token
    }

    if (!token) {
      return next(new Error('UNAUTHORIZED: Authentication session required for WebSocket connection.'))
    }

    try {
      const user = jwt.verify(token, config.jwtSecret) as AuthPayload
      socket.data.user = user
      next()
    } catch {
      return next(new Error('UNAUTHORIZED: Invalid or expired WebSocket authentication session.'))
    }
  })

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as AuthPayload | undefined
    console.log(`[Socket.IO] Authenticated client connected: ${socket.id} (${user?.email})`)

    // Phase 8: Authorize device room subscription based on ownership or ADMIN role
    socket.on('subscribe:device', async (deviceId: string) => {
      if (!deviceId || typeof deviceId !== 'string') {
        socket.emit('subscribe:error', { deviceId, message: 'Invalid device ID.' })
        return
      }

      if (!user) {
        socket.emit('subscribe:error', { deviceId, message: 'Unauthenticated socket session.' })
        return
      }

      try {
        const device = await Device.findOne({ deviceId: deviceId.trim() })
        if (!device) {
          socket.emit('subscribe:error', { deviceId, message: `Device '${deviceId}' not found.` })
          return
        }

        const isOwner = device.ownerId && device.ownerId.toString() === user.userId
        const isAdmin = user.role === 'ADMIN'

        if (!isOwner && !isAdmin) {
          console.warn(`[Socket.IO Security] Unauthorized subscription attempt to device ${deviceId} by ${user.email}`)
          socket.emit('subscribe:error', {
            deviceId,
            message: 'Access denied: you do not have permission to subscribe to this device.',
          })
          return
        }

        socket.join(`device:${deviceId}`)
        console.log(`[Socket.IO] Authorized client ${socket.id} (${user.email}) joined room device:${deviceId}`)
        socket.emit('subscribed', { deviceId })
      } catch (err) {
        console.error('[Socket.IO] Error verifying device subscription:', err)
        socket.emit('subscribe:error', { deviceId, message: 'Internal error verifying device authorization.' })
      }
    })

    socket.on('unsubscribe:device', (deviceId: string) => {
      socket.leave(`device:${deviceId}`)
      console.log(`[Socket.IO] Client ${socket.id} left room device:${deviceId}`)
    })

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`)
    })
  })

  return io
}

export function getIO(): SocketIOServer | null {
  return io
}

// Broadcasters: Strictly scoped to authorized device room (Phase 6: No global telemetry broadcast!)
export function emitTelemetryUpdate(deviceId: string, payload: unknown): void {
  if (!io) return
  io.to(`device:${deviceId}`).emit('telemetry:update', payload)
}

export function emitFootstepDetected(deviceId: string, event: unknown): void {
  if (!io) return
  io.to(`device:${deviceId}`).emit('footstep:detected', event)
}

export function emitDeviceStatus(deviceId: string, status: unknown): void {
  if (!io) return
  io.to(`device:${deviceId}`).emit('device:status', status)
}

export function emitLoadStateChanged(deviceId: string, loads: unknown): void {
  if (!io) return
  io.to(`device:${deviceId}`).emit('load:stateChanged', loads)
}

export function emitAlertCreated(alert: any): void {
  if (!io) return
  if (alert && alert.deviceId) {
    io.to(`device:${alert.deviceId}`).emit('alert:created', alert)
  }
}

export function emitAlertResolved(alert: any): void {
  if (!io) return
  if (alert && alert.deviceId) {
    io.to(`device:${alert.deviceId}`).emit('alert:resolved', alert)
  }
}

export function emitMlPrediction(deviceId: string, prediction: unknown): void {
  if (!io) return
  io.to(`device:${deviceId}`).emit('ml:prediction', prediction)
}
