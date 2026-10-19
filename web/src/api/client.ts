import type { ProblemDetails } from './types'

/** Supplies the auth headers for each API call (development user id or an Entra bearer token). */
export type AuthHeaderProvider = () => Promise<Record<string, string>>

let authHeaders: AuthHeaderProvider = async () => ({})

/** Called once by the AuthProvider when sign-in is ready. */
export function setAuthHeaderProvider(provider: AuthHeaderProvider): void {
  authHeaders = provider
}

/** An HTTP error from the API, carrying its Problem Details when the server sent them. */
export class ApiError extends Error {
  readonly status: number
  readonly problem: ProblemDetails | null

  constructor(status: number, problem: ProblemDetails | null) {
    super(problem?.detail ?? problem?.title ?? `Request failed (${status})`)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

/** Calls the API and returns parsed JSON. Throws ApiError on a non-2xx response. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  for (const [name, value] of Object.entries(await authHeaders())) {
    headers.set(name, value)
  }

  const response = await fetch(path, { ...init, headers })
  if (!response.ok) {
    let problem: ProblemDetails | null = null
    try {
      problem = (await response.json()) as ProblemDetails
    } catch {
      // Not JSON (e.g. a 401 with no body); the status code is enough.
    }
    throw new ApiError(response.status, problem)
  }

  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}
