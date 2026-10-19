import { FluentProvider, webLightTheme } from '@fluentui/react-components'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { AuthProvider } from './AuthProvider'

const team = [
  {
    id: 1,
    displayName: 'Max Caber',
    email: 'mcaber@cta.org',
    initials: 'MC',
    isDeveloper: true,
    isIca: false,
    isSupervisor: false,
  },
  {
    id: 5,
    displayName: 'Michael Lamuth',
    email: 'mlamuth@cta.org',
    initials: 'ML',
    isDeveloper: true,
    isIca: true,
    isSupervisor: false,
  },
  {
    id: 6,
    displayName: 'Elyse Orris',
    email: 'eorris@cta.org',
    initials: 'EO',
    isDeveloper: false,
    isIca: true,
    isSupervisor: false,
  },
  {
    id: 11,
    displayName: 'Ken Fukumoto',
    email: 'kfukumoto@cta.org',
    initials: 'KF',
    isDeveloper: false,
    isIca: false,
    isSupervisor: true,
  },
]

/** A fake API: development mode, the team above, and /me for whoever is in the X-Dev-User-Id header. */
function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

    if (url.endsWith('/api/v1/auth-config'))
      return json({ mode: 'Development', tenantId: null, clientId: null, apiScope: null })
    if (url.endsWith('/api/v1/dev/sign-in-options')) return json(team)
    if (url.endsWith('/api/v1/me')) {
      const id = Number(new Headers(init?.headers).get('X-Dev-User-Id'))
      const me = team.find((p) => p.id === id)
      return me ? json(me) : json({ title: 'Unauthorized' }, 401)
    }
    if (url.endsWith('/api/v1/applications')) return json([])
    return json({ title: 'Not found' }, 404)
  })
}

function renderApp() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <FluentProvider theme={webLightTheme}>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </FluentProvider>,
  )
}

describe('development sign-in', () => {
  it('lists the team grouped by role, with Michael shown as both developer and ICA', async () => {
    mockApi()
    renderApp()

    expect(await screen.findByRole('heading', { name: 'Developers' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ICAs' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ISSD Supervisor' })).toBeInTheDocument()
    expect(screen.getByText('Developer · ICA')).toBeInTheDocument()
  })

  it('signs in as the chosen person and shows the app shell', async () => {
    mockApi()
    renderApp()

    await userEvent.click(await screen.findByRole('button', { name: /Ken Fukumoto/ }))

    expect(await screen.findByRole('heading', { name: /, Ken$/ })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
    expect(localStorage.getItem('bt.devUserId')).toBe('11')
  })

  it('goes back to the sign-in page when the remembered person no longer exists', async () => {
    localStorage.setItem('bt.devUserId', '999')
    mockApi()
    renderApp()

    await waitFor(() => expect(localStorage.getItem('bt.devUserId')).toBeNull())
    expect(await screen.findByRole('heading', { name: 'Developers' })).toBeInTheDocument()
  })
})
