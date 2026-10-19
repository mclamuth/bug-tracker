import { FluentProvider, webLightTheme } from '@fluentui/react-components'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { NotifyProvider } from '../components/NotifyProvider'

export interface ApiCall {
  method: string
  path: string
  body: unknown
}

type Handler = (call: ApiCall) => { status?: number; body?: unknown } | undefined

/**
 * Replaces fetch with a fake API. Each handler gets the call and returns a response, or undefined to pass.
 * Returns the list of calls made, so tests can check what was sent.
 */
export function mockApi(...handlers: Handler[]): ApiCall[] {
  const calls: ApiCall[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://localhost')
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body
    const call = { method: init?.method ?? 'GET', path: url.pathname + url.search, body }
    calls.push(call)
    for (const handler of handlers) {
      const result = handler(call)
      if (result) {
        return new Response(result.body === undefined ? null : JSON.stringify(result.body), {
          status: result.status ?? 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }
    return new Response(JSON.stringify({ title: `No fake for ${call.method} ${call.path}` }), { status: 404 })
  })
  return calls
}

/** GET handler for one path (query string ignored unless given). */
export const get =
  (path: string, body: unknown): Handler =>
  (call) =>
    call.method === 'GET' && (call.path === path || call.path.split('?')[0] === path) ? { body } : undefined

/** Renders the routes at a starting URL, with the app's providers. */
export function renderAt(url: string, routes: { path: string; element: ReactNode }[]) {
  const router = createMemoryRouter(routes, { initialEntries: [url] })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } },
  })
  render(
    <FluentProvider theme={webLightTheme}>
      <QueryClientProvider client={queryClient}>
        <NotifyProvider>
          <RouterProvider router={router} />
        </NotifyProvider>
      </QueryClientProvider>
    </FluentProvider>,
  )
  return router
}

// ---------- Sample data ----------

export const people = {
  max: { id: 1, displayName: 'Max Caber', initials: 'MC' },
  hue: { id: 3, displayName: 'Hue Chi', initials: 'HC' },
  elyse: { id: 6, displayName: 'Elyse Orris', initials: 'EO' },
  ken: { id: 11, displayName: 'Ken Fukumoto', initials: 'KF' },
}

const user = (p: { id: number; displayName: string; initials: string }, roles: Partial<Record<string, boolean>>) => ({
  ...p,
  email: `${p.displayName.split(' ')[0]!.toLowerCase()}@cta.org`,
  isDeveloper: false,
  isIca: false,
  isSupervisor: false,
  ...roles,
})

export const users = {
  me: user(people.elyse, { isIca: true }),
  developers: [user(people.max, { isDeveloper: true }), user(people.hue, { isDeveloper: true })],
  supervisors: [user(people.ken, { isSupervisor: true })],
}

export const applications = [
  {
    id: 17,
    name: 'Overtime',
    description: null,
    defaultAssigneeId: 3,
    defaultAssigneeName: 'Hue Chi',
    launcherUrl: null,
    isActive: true,
    openTickets: 1,
  },
  {
    id: 19,
    name: 'Staff Expense',
    description: null,
    defaultAssigneeId: 1,
    defaultAssigneeName: 'Max Caber',
    launcherUrl: null,
    isActive: true,
    openTickets: 2,
  },
]

export const lookups = {
  statuses: [
    { id: 1, name: 'New', sortOrder: 1, isClosed: false },
    { id: 3, name: 'Assigned', sortOrder: 3, isClosed: false },
    { id: 4, name: 'In Progress', sortOrder: 4, isClosed: false },
  ],
  transitions: [],
  ticketTypes: [],
  severities: [],
  priorities: [],
  environments: [],
  resolutions: [],
}

/** The handlers every page needs: who I am, the team, applications and lookups. */
export const directory: Handler[] = [
  get('/api/v1/me', users.me),
  // Role lists before the full list, which would otherwise match first.
  (call) => (call.path === '/api/v1/users?role=developer' ? { body: users.developers } : undefined),
  (call) => (call.path === '/api/v1/users?role=supervisor' ? { body: users.supervisors } : undefined),
  get('/api/v1/users', [users.me, ...users.developers, ...users.supervisors]),
  get('/api/v1/applications', applications),
  get('/api/v1/lookups', lookups),
  get('/api/v1/tickets/counts', { open: 2, unassigned: 1, assignedToMe: 0, reportedByMe: 1, closed: 0, all: 2 }),
]

export const listItem = (number: number, overrides: Record<string, unknown> = {}) => ({
  number,
  displayNumber: `BT-${number}`,
  type: 'Defect',
  title: `Ticket ${number}`,
  applicationId: 19,
  applicationName: 'Staff Expense',
  severity: 'High',
  priority: 'P2High',
  statusId: 3,
  statusName: 'Assigned',
  assignee: people.max,
  reporter: people.elyse,
  createdAt: '2026-10-19T15:00:00Z',
  updatedAt: '2026-10-19T15:00:00Z',
  ...overrides,
})

export const ticketDetail = (overrides: Record<string, unknown> = {}) => ({
  ...listItem(1042, { title: 'Mileage total doubles when a trip is edited' }),
  description: 'Editing a submitted trip adds the new mileage to the old amount.',
  endUserName: 'Diane Cole, Membership',
  stepsToReproduce: '1. Open a report\n2. Edit the trip',
  expectedResult: 'Total reflects the new distance',
  actualResult: 'Old and new amounts are added',
  environment: 'Production',
  isClosed: false,
  resolution: null,
  duplicateOfNumber: null,
  dueDate: null,
  closedAt: null,
  rowVersion: 'AAAAAAAAB9E=',
  allowedTransitions: [],
  comments: [
    {
      id: 5,
      author: people.max,
      body: '@Elyse Orris this is ready for you to retest.',
      mentions: [people.elyse],
      createdAt: '2026-10-19T14:00:00Z',
      editedAt: null,
    },
  ],
  attachments: [
    {
      id: 9,
      fileName: 'mileage-total.png',
      contentType: 'image/png',
      sizeBytes: 290_816,
      commentId: null,
      uploadedBy: people.elyse,
      uploadedAt: '2026-10-19T13:00:00Z',
    },
  ],
  ...overrides,
})
