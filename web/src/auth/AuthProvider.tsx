import type { PublicClientApplication } from '@azure/msal-browser'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiFetch, setAuthHeaderProvider } from '../api/client'
import type { AuthConfigDto } from '../api/types'
import { AuthContext, DEV_USER_KEY, readDevUserId, type AuthContextValue, type AuthStatus } from './authContext'

/**
 * Loads the sign-in mode from the API, then provides either the development "sign in as" flow
 * or Microsoft Entra sign-in. Both attach headers to every API call. The header provider reads
 * the current sign-in at call time, so it is set once and never depends on React render order.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [config, setConfig] = useState<AuthConfigDto | null>(null)
  const [msal, setMsal] = useState<PublicClientApplication | null>(null)
  const [entraSignedIn, setEntraSignedIn] = useState(false)
  const [devUserId, setDevUserId] = useState<number | null>(() => readDevUserId())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiFetch<AuthConfigDto>('/api/v1/auth-config')
      .then(async (cfg) => {
        if (cfg.mode === 'Development') {
          setAuthHeaderProvider(async (): Promise<Record<string, string>> => {
            const id = readDevUserId()
            return id === null ? {} : { 'X-Dev-User-Id': String(id) }
          })
        } else {
          const instance = await createMsal(cfg)
          const scopes = [cfg.apiScope!]
          setAuthHeaderProvider(async (): Promise<Record<string, string>> => {
            const account = instance.getActiveAccount()
            if (!account) return {}
            try {
              const token = await instance.acquireTokenSilent({ scopes, account })
              return { Authorization: `Bearer ${token.accessToken}` }
            } catch (e) {
              const { InteractionRequiredAuthError } = await import('@azure/msal-browser')
              if (e instanceof InteractionRequiredAuthError) await instance.acquireTokenRedirect({ scopes, account })
              throw e
            }
          })
          if (cancelled) return
          setMsal(instance)
          setEntraSignedIn(instance.getActiveAccount() !== null)
        }
        if (!cancelled) setConfig(cfg)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not reach the Bug Tracker API.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const signInAsDeveloper = useCallback(
    (userId: number) => {
      localStorage.setItem(DEV_USER_KEY, String(userId))
      queryClient.clear()
      setDevUserId(userId)
    },
    [queryClient],
  )

  const signInWithMicrosoft = useCallback(async () => {
    if (msal && config?.apiScope) await msal.loginRedirect({ scopes: [config.apiScope] })
  }, [msal, config])

  const signOut = useCallback(async () => {
    queryClient.clear()
    if (config?.mode === 'Entra' && msal) {
      await msal.logoutRedirect({ account: msal.getActiveAccount() ?? undefined })
      return
    }
    localStorage.removeItem(DEV_USER_KEY)
    setDevUserId(null)
  }, [config, msal, queryClient])

  const value = useMemo<AuthContextValue>(() => {
    let status: AuthStatus = 'loading'
    if (error) status = 'error'
    else if (config?.mode === 'Development') status = devUserId === null ? 'signedOut' : 'signedIn'
    else if (config?.mode === 'Entra') status = entraSignedIn ? 'signedIn' : 'signedOut'
    return { status, mode: config?.mode ?? null, error, signInAsDeveloper, signInWithMicrosoft, signOut }
  }, [error, config, devUserId, entraSignedIn, signInAsDeveloper, signInWithMicrosoft, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

async function createMsal(cfg: AuthConfigDto): Promise<PublicClientApplication> {
  if (!cfg.clientId || !cfg.tenantId || !cfg.apiScope) {
    throw new Error('Microsoft sign-in is not configured yet (missing client id, tenant id or API scope).')
  }
  // Loaded only in Entra mode, so local development doesn't download MSAL.
  const { PublicClientApplication } = await import('@azure/msal-browser')
  const instance = new PublicClientApplication({
    auth: {
      clientId: cfg.clientId,
      authority: `https://login.microsoftonline.com/${cfg.tenantId}`,
      redirectUri: window.location.origin,
    },
    cache: { cacheLocation: 'sessionStorage' },
  })
  await instance.initialize()
  const result = await instance.handleRedirectPromise()
  const account = result?.account ?? instance.getAllAccounts()[0] ?? null
  if (account) instance.setActiveAccount(account)
  return instance
}
