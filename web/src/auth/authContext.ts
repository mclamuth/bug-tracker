import { createContext, useContext } from 'react'
import type { AuthConfigDto } from '../api/types'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'error'

export interface AuthContextValue {
  status: AuthStatus
  mode: AuthConfigDto['mode'] | null
  error: string | null
  /** Development mode only: sign in as one of the seeded team members. */
  signInAsDeveloper: (userId: number) => void
  /** Entra mode: redirect to the Microsoft sign-in page. */
  signInWithMicrosoft: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.')
  return context
}

/** Where development sign-in remembers who you picked (this browser only). */
export const DEV_USER_KEY = 'bt.devUserId'

export function readDevUserId(): number | null {
  try {
    const raw = localStorage.getItem(DEV_USER_KEY)
    const id = raw === null ? NaN : Number.parseInt(raw, 10)
    return Number.isFinite(id) ? id : null
  } catch {
    return null
  }
}
