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

  /** The first validation message for each field, keyed by camelCase field name. */
  get fieldErrors(): Record<string, string> {
    return Object.fromEntries(
      Object.entries(this.problem?.errors ?? {}).map(([field, messages]) => [field, messages[0] ?? '']),
    )
  }
}

/** Calls the API and returns parsed JSON. Throws ApiError on a non-2xx response. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await send(path, init)
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

/** Sends a JSON body with the given method and returns the parsed response. */
export function apiSend<T>(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  return apiFetch<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })
}

/** Downloads a file from the API (with the auth headers a plain link can't send) and saves it under its name. */
export async function apiDownload(path: string, fileName: string): Promise<void> {
  const response = await send(path, {}, '*/*')
  const url = URL.createObjectURL(await response.blob())
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.append(link)
    link.click()
    link.remove()
  } finally {
    // Give the browser a moment to start the download before releasing the file.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

async function send(path: string, init: RequestInit, accept = 'application/json'): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Accept', accept)
  // JSON bodies are strings; FormData (file uploads) sets its own multipart Content-Type.
  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
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
  return response
}
