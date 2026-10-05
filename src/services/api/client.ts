/**
 * StepCharge AI — Frontend API Client
 * Configures the backend base URL and unified fetch helper with HTTP-only cookie support.
 */

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:5000/api'

export const SOCKET_BASE_URL =
  (import.meta.env.VITE_SOCKET_URL as string | undefined)?.replace(/\/$/, '') ||
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/api\/?$/, '') ||
  'http://localhost:5000'

export const deviceId = () => (import.meta.env.VITE_DEVICE_ID as string) || 'ESP32-01'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`

  const res = await fetch(url, {
    ...options,
    credentials: 'include', // Essential for HTTP-only session cookies
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  let json: ApiResponse<T>
  try {
    json = await res.json()
  } catch {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }

  if (!res.ok || !json.success) {
    const errorMsg = json.error?.message || `Request failed with status ${res.status}`
    throw new Error(errorMsg)
  }

  return json.data as T
}
