import { fetchApi } from './client'

export interface AuthUser {
  uid: string
  email: string | null
  name?: string
  avatarUrl?: string
  role?: 'USER' | 'ADMIN'
}

export type AuthMode = 'google' | 'demo-gate'

export const isBackendConfigured = (): boolean => true

export const authMode = (): AuthMode => 'google'

export async function getGoogleLoginUrl(): Promise<string> {
  const data = await fetchApi<{ url: string }>('/auth/google/url')
  return data.url
}

export async function signInWithGoogleToken(idToken: string): Promise<AuthUser> {
  const data = await fetchApi<{ user: any }>('/auth/google/token', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  })
  return {
    uid: data.user.id || data.user.googleId,
    email: data.user.email,
    name: data.user.name,
    avatarUrl: data.user.avatarUrl,
    role: data.user.role,
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const data = await fetchApi<{ user: any }>('/auth/me')
    if (!data || !data.user) return null
    return {
      uid: data.user.id || data.user.googleId,
      email: data.user.email,
      name: data.user.name,
      avatarUrl: data.user.avatarUrl,
      role: data.user.role,
    }
  } catch {
    return null
  }
}

export async function signOut(): Promise<void> {
  try {
    await fetchApi('/auth/logout', { method: 'POST' })
  } catch {
    // Ignore error on sign out
  }
}

export async function devLogin(): Promise<AuthUser | null> {
  try {
    const data = await fetchApi<{ user: any }>('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    if (!data || !data.user) return null
    return {
      uid: data.user.id || data.user.googleId,
      email: data.user.email,
      name: data.user.name,
      avatarUrl: data.user.avatarUrl,
      role: data.user.role,
    }
  } catch {
    return null
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
  const data = await fetchApi<{ user: any }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return {
    uid: data.user.id || data.user.googleId,
    email: data.user.email,
    name: data.user.name,
    avatarUrl: data.user.avatarUrl,
    role: data.user.role,
  }
}

export async function registerWithEmail(email: string, password: string, name?: string): Promise<AuthUser> {
  const data = await fetchApi<{ user: any }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  })
  return {
    uid: data.user.id || data.user.googleId,
    email: data.user.email,
    name: data.user.name,
    avatarUrl: data.user.avatarUrl,
    role: data.user.role,
  }
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const data = await fetchApi<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
  return data
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<{ message: string; user?: AuthUser }> {
  const data = await fetchApi<{ message: string; user?: any }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  })
  return {
    message: data.message,
    user: data.user
      ? {
          uid: data.user.id || data.user.googleId,
          email: data.user.email,
          name: data.user.name,
          avatarUrl: data.user.avatarUrl,
          role: data.user.role,
        }
      : undefined,
  }
}

export async function watchAuth(cb: (u: AuthUser | null) => void): Promise<() => void> {
  let alive = true
  getCurrentUser()
    .then((user) => {
      if (alive) cb(user)
    })
    .catch(() => {
      if (alive) cb(null)
    })

  return () => {
    alive = false
  }
}
