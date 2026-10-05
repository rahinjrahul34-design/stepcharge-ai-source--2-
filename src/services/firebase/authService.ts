import { firebaseEnv, isFirebaseConfigured } from './config'

/**
 * Firebase Authentication.
 *
 * Why this exists: the hardened security rules require `auth != null` for every
 * read and write. A cosmetic "login" that only flips React state cannot satisfy
 * them — the RTDB would reject every request. So in LIVE mode the dashboard
 * performs a real email/password sign-in and the SDK attaches the resulting ID
 * token to each request.
 *
 * In DEMO mode (no Firebase configured) there is nothing to protect and no
 * backend to authenticate against, so a clearly-labelled local gate is used
 * instead. That gate grants access to simulated data only.
 */

export interface AuthUser {
  uid: string
  email: string | null
}

export type AuthMode = 'firebase' | 'demo-gate'

/** Real authentication is only possible when Firebase is configured. */
export const authMode = (): AuthMode => (isFirebaseConfigured() ? 'firebase' : 'demo-gate')

async function getAuth() {
  const [{ initializeApp, getApps }, authMod] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
  ])
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        apiKey: firebaseEnv.apiKey!,
        authDomain: firebaseEnv.authDomain,
        databaseURL: firebaseEnv.databaseURL!,
        projectId: firebaseEnv.projectId!,
        appId: firebaseEnv.appId,
      })
  return { auth: authMod.getAuth(app), mod: authMod }
}

/** Maps Firebase's error codes to messages a human can act on. */
function friendly(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address is not valid.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.'
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Wait a moment and try again.'
    case 'auth/network-request-failed':
      return 'Network error — could not reach Firebase Authentication.'
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is disabled in the Firebase console. Enable it under Authentication → Sign-in method.'
    default:
      return `Sign-in failed (${code}).`
  }
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const { auth, mod } = await getAuth()
  try {
    const cred = await mod.signInWithEmailAndPassword(auth, email, password)
    return { uid: cred.user.uid, email: cred.user.email }
  } catch (e) {
    throw new Error(friendly((e as { code?: string }).code ?? 'unknown'))
  }
}

export async function signOut(): Promise<void> {
  const { auth, mod } = await getAuth()
  await mod.signOut(auth)
}

/** Restores an existing session on reload; returns an unsubscribe function. */
export async function watchAuth(cb: (u: AuthUser | null) => void): Promise<() => void> {
  const { auth, mod } = await getAuth()
  return mod.onAuthStateChanged(auth, (u) =>
    cb(u ? { uid: u.uid, email: u.email } : null),
  )
}
