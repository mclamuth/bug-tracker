import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { directory, get, listItem, mockApi, people, renderAt, ticketDetail, users } from '../test/renderPage'
import { MyWorkPage } from './MyWorkPage'

const routes = [{ path: '/', element: <MyWorkPage /> }]

const dashboard = {
  counts: {
    assignedToMe: 3,
    myReopened: 1,
    criticalOpen: 2,
    openedThisWeek: 7,
    readyForTest: 1,
    reportedByMe: 4,
    reopened: 1,
    needsTriage: 2,
    unassigned: 2,
    openWithDeveloper: 5,
    activeDevelopment: 4,
  },
  myActive: [
    listItem(1050, { title: 'Came back from testing', statusId: 8, statusName: 'Reopened' }),
    listItem(1051, { title: 'Working on it', statusId: 4, statusName: 'In Progress' }),
  ],
  readyForTest: [listItem(1060, { title: 'Please verify me', statusId: 5, statusName: 'Ready for Test' })],
  reportedByMe: [listItem(1070, { title: 'Something I reported', statusName: 'Assigned' })],
  needsTriage: [listItem(1080, { title: 'Needs a developer', statusId: 1, statusName: 'New', assignee: null })],
  workload: [
    { developer: people.max, assigned: 1, inProgress: 2, reopened: 1 },
    { developer: people.hue, assigned: 0, inProgress: 0, reopened: 0 },
  ],
  recentActivity: [
    {
      kind: 'status',
      by: people.hue,
      at: '2026-10-20T18:00:00Z',
      ticketNumber: 1037,
      ticketTitle: 'Board expense',
      oldValue: 'In Progress',
      newValue: 'Ready for Test',
    },
    {
      kind: 'comment',
      by: people.elyse,
      at: '2026-10-20T17:00:00Z',
      ticketNumber: 1042,
      ticketTitle: 'Mileage',
      oldValue: null,
      newValue: null,
    },
  ],
}

/** The fake API, signed in as someone with the given roles. */
const apiAs = (
  roles: Partial<Record<'isDeveloper' | 'isIca' | 'isSupervisor', boolean>>,
  ...extra: Parameters<typeof mockApi>
) =>
  mockApi(
    get('/api/v1/me', { ...users.me, isDeveloper: false, isIca: false, isSupervisor: false, ...roles }),
    get('/api/v1/dashboard', dashboard),
    ...extra,
    ...directory,
  )

describe('My Work', () => {
  it('shows a developer their active work, grouped, and the team’s recent activity', async () => {
    apiAs({ isDeveloper: true })
    renderAt('/', routes)

    expect(await screen.findByRole('link', { name: /3 Assigned to me/ })).toHaveAttribute(
      'href',
      '/tickets?view=assigned-to-me',
    )
    expect(screen.getByRole('link', { name: /1 Reopened Returned from testing/ })).toBeInTheDocument()
    const mine = screen.getByRole('region', { name: 'Assigned to me' })
    expect(within(mine).getByRole('group', { name: 'Reopened' })).toHaveTextContent('Came back from testing')
    expect(within(mine).getByRole('group', { name: 'In Progress' })).toHaveTextContent('Working on it')
    const recent = screen.getByRole('region', { name: 'Recently updated' })
    expect(within(recent).getByText(/moved/)).toHaveTextContent('Hue Chi moved BT-1037 to Ready for Test')
    expect(within(recent).getByText(/commented on/)).toHaveTextContent('Elyse Orris commented on BT-1042')
    // One role: no switcher.
    expect(screen.queryByRole('tablist', { name: 'View My Work as' })).not.toBeInTheDocument()
  })

  it('shows an ICA the testing queue and what they reported', async () => {
    apiAs({ isIca: true })
    renderAt('/', routes)

    const queue = await screen.findByRole('region', { name: 'Ready for Test' })
    expect(within(queue).getByRole('link', { name: /Please verify me.*Start testing/ })).toHaveAttribute(
      'href',
      '/tickets/1060',
    )
    expect(screen.getByRole('region', { name: 'Reported by me' })).toHaveTextContent('Something I reported')
    expect(screen.getByRole('link', { name: /1 Ready for Test/ })).toHaveAttribute('href', '/tickets?statusId=5')
  })

  it('lets someone with two roles switch views, and remembers the choice', async () => {
    apiAs({ isDeveloper: true, isIca: true })
    renderAt('/', routes)

    const switcher = await screen.findByRole('tablist', { name: 'View My Work as' })
    expect(within(switcher).getByRole('tab', { name: 'Developer' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(within(switcher).getByRole('tab', { name: 'ICA' }))
    expect(await screen.findByRole('region', { name: 'Ready for Test' })).toBeInTheDocument()
    expect(localStorage.getItem('bt.dashboardRole')).toBe('ica')
  })

  it('lets the supervisor triage from the dashboard and see the team’s workload', async () => {
    const calls = apiAs(
      { isSupervisor: true },
      get(
        '/api/v1/tickets/1080',
        ticketDetail({ number: 1080, displayNumber: 'BT-1080', statusId: 1, statusName: 'New', assignee: null }),
      ),
      (call) =>
        call.method === 'PUT' && call.path.endsWith('/assignee') ? { body: ticketDetail({ number: 1080 }) } : undefined,
    )
    renderAt('/', routes)

    const workload = await screen.findByRole('region', { name: 'Team workload' })
    expect(within(workload).getByRole('link', { name: /Max Caber.*4 active tickets/ })).toHaveAttribute(
      'href',
      '/tickets?assigneeId=1',
    )

    const triage = screen.getByRole('region', { name: 'Needs triage' })
    await userEvent.click(within(triage).getByRole('button', { name: 'Triage' }))
    const dialog = await screen.findByRole('dialog', { name: /Triage and assign/ })
    await userEvent.click(within(dialog).getByRole('radio', { name: /Hue Chi/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign' }))

    await waitFor(() =>
      expect(calls.some((c) => c.method === 'PUT' && c.path === '/api/v1/tickets/1080/assignee')).toBe(true),
    )
  })

  it('links to the other roles’ queues on request', async () => {
    apiAs({ isDeveloper: true })
    renderAt('/', routes)

    await userEvent.click(await screen.findByRole('button', { name: 'Other sections' }))
    expect(screen.getByRole('link', { name: /View testing queue/ })).toHaveAttribute('href', '/tickets?statusId=5')
    expect(screen.getByRole('link', { name: /View triage queue/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /View developer work/ })).not.toBeInTheDocument()
  })
})
