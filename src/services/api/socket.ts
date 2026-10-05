import { io, Socket } from 'socket.io-client'
import { SOCKET_BASE_URL, deviceId } from './client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_BASE_URL, {
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to backend, subscribing to device:', deviceId())
      socket?.emit('subscribe:device', deviceId())
    })

    socket.on('connect_error', (err) => {
      console.warn('[Socket.IO] Connection error:', err.message)
    })
  }

  return socket
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
