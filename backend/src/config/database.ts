import dns from 'node:dns'
import mongoose from 'mongoose'
import { config } from './env.js'

let isConnected = false

export async function connectDatabase(): Promise<void> {
  if (isConnected) return

  try {
    if (!config.mongoUri.startsWith('mongodb://') && !config.mongoUri.startsWith('mongodb+srv://')) {
      throw new Error('MONGODB_URI must begin with mongodb:// or mongodb+srv://.')
    }

    if (config.mongoUri.startsWith('mongodb+srv://')) {
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4'])
      } catch {
        // Fallback gracefully if custom DNS servers cannot be set
      }
    }

    mongoose.set('strictQuery', true)
    mongoose.set('bufferCommands', false)
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 10000,
    })
    isConnected = true
    console.log('[MongoDB] Connected successfully to MongoDB Atlas / Database')
  } catch (error) {
    console.error('[MongoDB] Connection error:', error instanceof Error ? error.message : error)
    throw error
  }
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1
}

export async function disconnectDatabase(): Promise<void> {
  if (isConnected) {
    await mongoose.disconnect()
    isConnected = false
    console.log('[MongoDB] Disconnected')
  }
}
