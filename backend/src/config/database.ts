import mongoose from 'mongoose'
import { config } from './env.js'

let isConnected = false

export async function connectDatabase(): Promise<void> {
  if (isConnected) return

  try {
    mongoose.set('strictQuery', true)
    mongoose.set('bufferCommands', false)
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    })
    isConnected = true
    console.log('[MongoDB] Connected successfully to MongoDB Atlas / Database')
  } catch (error) {
    console.error('[MongoDB] Connection error:', error instanceof Error ? error.message : error)
    // Non-fatal on startup so the app can start and report health status gracefully
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
