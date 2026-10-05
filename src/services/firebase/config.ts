import type { Database } from 'firebase/database'

/**
 * Firebase configuration — PUBLIC client config only.
 *
 * The values below are the standard web client config, which Firebase itself
 * documents as non-secret; access is controlled by Security Rules, not secrecy.
 * Service-account JSON, admin credentials and ML API secrets must NEVER appear
 * in this bundle — they belong on a server or in Cloud Functions.
 *
 * Realtime Database was chosen over Firestore: telemetry is a high-frequency
 * append-only stream keyed by timestamp, which is exactly RTDB's strength, and
 * the ESP32 can push to it over plain HTTPS/REST without a heavy SDK.
 */
export interface FirebaseEnv {
  apiKey: string
  authDomain: string
  databaseURL: string
  projectId: string
  appId: string
  storageBucket: string
  messagingSenderId: string
  deviceId: string
}

export const firebaseEnv: Partial<FirebaseEnv> = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  // Accept either name so the documented VITE_FIREBASE_DATABASE_URL also works.
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || import.meta.env.VITE_FIREBASE_DB_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  deviceId: import.meta.env.VITE_DEVICE_ID || 'ESP32-01',
}

/** Live mode is only offered when the minimum config is actually present. */
export const isFirebaseConfigured = (): boolean =>
  Boolean(firebaseEnv.databaseURL && firebaseEnv.apiKey && firebaseEnv.projectId)

let dbPromise: Promise<Database> | null = null

/**
 * Lazily initialises the SDK exactly once. Dynamic import keeps the ~200 kB
 * Firebase chunk out of the initial bundle for users who stay in demo mode.
 */
export async function getDb(): Promise<Database> {
  if (!isFirebaseConfigured())
    throw new Error(
      'Firebase is not configured. Set VITE_FIREBASE_DB_URL, VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID in .env.local.',
    )
  if (!dbPromise) {
    dbPromise = (async () => {
      const [{ initializeApp, getApps }, { getDatabase }] = await Promise.all([
        import('firebase/app'),
        import('firebase/database'),
      ])
      const app = getApps().length
        ? getApps()[0]
        : initializeApp({
            apiKey: firebaseEnv.apiKey!,
            authDomain: firebaseEnv.authDomain,
            databaseURL: firebaseEnv.databaseURL!,
            projectId: firebaseEnv.projectId!,
            appId: firebaseEnv.appId,
            storageBucket: firebaseEnv.storageBucket,
            messagingSenderId: firebaseEnv.messagingSenderId,
          })
      return getDatabase(app)
    })()
  }
  return dbPromise
}

export const deviceId = () => firebaseEnv.deviceId || 'ESP32-01'

/** Database layout — mirrored by the ESP32 firmware and the security rules. */
export const paths = {
  device: (id: string) => `devices/${id}`,
  telemetryLatest: (id: string) => `telemetry/${id}/latest`,
  telemetry: (id: string) => `telemetry/${id}/history`,
  events: (id: string) => `footstepEvents/${id}`,
  alerts: () => 'alerts',
  health: (id: string) => `systemHealth/${id}`,
  piezo: (id: string) => `devices/${id}/piezoArray`,
  model: () => 'modelMetadata',
  loads: (id: string) => `devices/${id}/loads`,
  dataset: (id: string) => `dataset/samples/${id}`,
}
