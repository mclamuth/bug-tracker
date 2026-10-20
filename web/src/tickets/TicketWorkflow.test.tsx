import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { directory, get, mockApi, people, renderAt, ticketDetail, type ApiCall } from '../test/renderPage'
import { StatusIds } from './labels'
import { TicketDetailPage } from './TicketDetailPage'

const routes = [{ path: '/tickets/:number', element: <TicketDetailPage /> }]

const moves = (
  from: number,
  ...to: [number, Partial<{ comment: boolean; assignee: boolean; resolution: boolean }>?][]
) =>
  to.map(([toStatusId, rule = {}]) => ({
    fromStatusId: from,
    toStatusId,
    requiresComment: rule.comment ?? false,
    requiresAssignee: rule.assignee ?? false,
    requiresResolution: rule.resolution ?? false,
  }))

const states = {
  new: ticketDetail({
    statusId: StatusIds.New,
    statusName: 'New',
    assignee: null,
    allowedTransitions: moves(
      StatusIds.New,
      [StatusIds.Assigned, { assignee: true }],
      [StatusIds.Triaged],
      [StatusIds.WontFix, { comment: true, resolution: true }],
    ),
  }),
  assigned: ticketDetail({
    statusId: StatusIds.Assigned,
    statusName: 'Assigned',
    allowedTransitions: moves(StatusIds.Assigned, [StatusIds.InProgress], [StatusIds.Triaged]),
  }),
  inProgress: ticketDetail({
    statusId: StatusIds.InProgress,
    statusName: 'In Progress',
    allowedTransitions: moves(
      StatusIds.InProgress,
      [StatusIds.ReadyForTest],
      [StatusIds.WontFix, { comment: true, resolution: true }],
    ),
  }),
  readyForTest: ticketDetail({
    statusId: StatusIds.ReadyForTest,
    statusName: 'Ready for Test',
    allowedTransitions: moves(StatusIds.ReadyForTest, [StatusIds.Verified], [StatusIds.Reopened, { comment: true }]),
  }),
}

/** The detail page for one ticket, answering any change with the ticket itself. */
function detailFor(ticket: ReturnType<typeof ticketDetail>, ...extra: Parameters<typeof mockApi>): ApiCall[] {
  return mockApi(
    ...extra,
    ...directory,
    (call) => (call.method !== 'GET' && call.path.startsWith('/api/v1/tickets/1042') ? { body: ticket } : undefined),
    get('/api/v1/tickets/1042', ticket),
    get('/api/v1/tickets/1042/history', []),
  )
}

const sent = (calls: ApiCall[], method: string, pathEnd: string) =>
  calls.find((c) => c.method === method && c.path.endsWith(pathEnd))

describe('workflow buttons', () => {
  it('triages a new ticket to a developer, defaulting to the application’s developer', async () => {
    const calls = detailFor(states.new)
    renderAt('/tickets/1042', routes)

    await userEvent.click(await screen.findByRole('button', { name: 'Triage' }))
    const dialog = await screen.findByRole('dialog', { name: /Triage and assign/ })
    // Staff Expense's developer is Max.
    expect(within(dialog).getByRole('radio', { name: /Max Caber/ })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(within(dialog).getByRole('radio', { name: /Hue Chi/ }))
    expect(within(dialog).getByText('Hue Chi will be notified by email.')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Comment' }), 'Overtime touches this too.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign' }))

    await waitFor(() => expect(sent(calls, 'PUT', '/assignee')).toBeDefined())
    expect(sent(calls, 'PUT', '/assignee')!.body).toEqual({
      assigneeId: 3,
      comment: 'Overtime touches this too.',
      rowVersion: 'AAAAAAAAB9E=',
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('can park a new ticket in the backlog instead', async () => {
    const calls = detailFor(states.new)
    renderAt('/tickets/1042', routes)
    await userEvent.click(await screen.findByRole('button', { name: 'Triage' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Move to backlog without assigning' }))

    await waitFor(() => expect(sent(calls, 'POST', '/transitions')).toBeDefined())
    expect(sent(calls, 'POST', '/transitions')!.body).toMatchObject({ toStatusId: StatusIds.Triaged })
  })

  it('starts work in one click', async () => {
    const calls = detailFor(states.assigned)
    renderAt('/tickets/1042', routes)
    expect(await screen.findByRole('button', { name: 'Unassign' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Start work' }))

    await waitFor(() => expect(sent(calls, 'POST', '/transitions')).toBeDefined())
    expect(sent(calls, 'POST', '/transitions')!.body).toEqual({
      toStatusId: StatusIds.InProgress,
      rowVersion: 'AAAAAAAAB9E=',
    })
  })

  it('sends a ticket to testing with an optional note', async () => {
    const calls = detailFor(states.inProgress)
    renderAt('/tickets/1042', routes)
    await userEvent.click(await screen.findByRole('button', { name: 'Ready for Test' }))
    const dialog = await screen.findByRole('dialog', { name: /Send to testing/ })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(sent(calls, 'POST', '/transitions')).toBeDefined())
    expect(sent(calls, 'POST', '/transitions')!.body).toMatchObject({
      toStatusId: StatusIds.ReadyForTest,
      comment: null,
    })
  })

  it('needs a reason and the original ticket to close as a duplicate', async () => {
    const calls = detailFor(
      states.inProgress,
      get(
        '/api/v1/tickets/1012',
        ticketDetail({ number: 1012, displayNumber: 'BT-1012', title: 'Mileage doubles (first report)' }),
      ),
    )
    renderAt('/tickets/1042', routes)
    await userEvent.click(await screen.findByRole('button', { name: 'Won’t Fix' }))
    const dialog = await screen.findByRole('dialog', { name: /Close as Won’t Fix/ })

    await userEvent.selectOptions(within(dialog).getByRole('combobox', { name: /Resolution/ }), 'Duplicate')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    expect(within(dialog).getByText('Explain why this ticket won’t be fixed.')).toBeInTheDocument()
    expect(within(dialog).getByText('Enter the ticket number, like BT-1042.')).toBeInTheDocument()
    expect(sent(calls, 'POST', '/transitions')).toBeUndefined()

    await userEvent.type(within(dialog).getByRole('textbox', { name: /Duplicate of/ }), 'BT-1012')
    expect(await within(dialog).findByText('BT-1012: Mileage doubles (first report)')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Comment/ }), 'Same as BT-1012.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }))

    await waitFor(() => expect(sent(calls, 'POST', '/transitions')).toBeDefined())
    expect(sent(calls, 'POST', '/transitions')!.body).toEqual({
      toStatusId: StatusIds.WontFix,
      comment: 'Same as BT-1012.',
      resolution: 'Duplicate',
      duplicateOfNumber: 1012,
      rowVersion: 'AAAAAAAAB9E=',
    })
  })

  it('asks what failed when a test fails', async () => {
    const calls = detailFor(states.readyForTest)
    renderAt('/tickets/1042', routes)
    expect(await screen.findByRole('button', { name: 'Mark Verified' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reopen' }))
    const dialog = await screen.findByRole('dialog', { name: /Reopen ticket/ })
    const box = within(dialog).getByRole('textbox', { name: /Comment/ })
    expect(box).toHaveAttribute('placeholder', 'What failed during testing?')

    await userEvent.type(box, 'Total still doubles after a second edit.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm reopen' }))
    await waitFor(() => expect(sent(calls, 'POST', '/transitions')).toBeDefined())
    expect(sent(calls, 'POST', '/transitions')!.body).toMatchObject({
      toStatusId: StatusIds.Reopened,
      comment: 'Total still doubles after a second edit.',
    })
  })

  it('shows the conflict banner when the ticket changed under the dialog', async () => {
    detailFor(states.assigned, (call) =>
      call.method === 'POST' && call.path.endsWith('/transitions')
        ? { status: 409, body: { title: 'Someone else updated this ticket. Reload to see the latest changes.' } }
        : undefined,
    )
    renderAt('/tickets/1042', routes)
    await userEvent.click(await screen.findByRole('button', { name: 'Start work' }))
    expect(await screen.findByText('Someone else updated this ticket.')).toBeInTheDocument()
  })
})

describe('comments and files', () => {
  const mine = ticketDetail({
    comments: [
      {
        id: 8,
        author: people.elyse, // the signed-in user in these tests
        body: 'Typo in the summary.',
        mentions: [],
        createdAt: '2026-10-19T15:00:00Z',
        editedAt: null,
      },
      {
        id: 5,
        author: people.max,
        body: 'Max’s comment',
        mentions: [],
        createdAt: '2026-10-19T14:00:00Z',
        editedAt: null,
      },
    ],
  })

  it('lets you edit and delete only your own comments', async () => {
    const calls = detailFor(mine, (call) =>
      call.path === '/api/v1/comments/8'
        ? { status: call.method === 'DELETE' ? 204 : 200, body: call.method === 'DELETE' ? undefined : {} }
        : undefined,
    )
    renderAt('/tickets/1042', routes)

    const own = await screen.findByRole('article', { name: 'Comment by Elyse Orris' })
    await userEvent.click(await within(own).findByRole('button', { name: 'Comment actions' }))
    const maxs = screen.getByRole('article', { name: 'Comment by Max Caber' })
    expect(within(maxs).queryByRole('button', { name: 'Comment actions' })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }))
    const box = within(own).getByRole('combobox', { name: 'Edit comment' })
    await userEvent.clear(box)
    await userEvent.type(box, 'Typo fixed in the summary.')
    await userEvent.click(within(own).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(sent(calls, 'PUT', '/comments/8')).toBeDefined())
    expect(sent(calls, 'PUT', '/comments/8')!.body).toEqual({ body: 'Typo fixed in the summary.' })

    await userEvent.click(within(own).getByRole('button', { name: 'Comment actions' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete this comment?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(sent(calls, 'DELETE', '/comments/8')).toBeDefined())
  })

  it('adds files to the ticket and removes your own', async () => {
    const calls = detailFor(
      ticketDetail(),
      (call) => (call.method === 'POST' && call.path.endsWith('/attachments') ? { status: 201, body: {} } : undefined),
      (call) => (call.method === 'DELETE' && call.path === '/api/v1/attachments/9' ? { status: 204 } : undefined),
    )
    renderAt('/tickets/1042', routes)
    await screen.findByRole('button', { name: 'Add file' })

    await userEvent.upload(
      screen.getByLabelText('Add files'),
      new File(['log'], 'error-log.txt', { type: 'text/plain' }),
    )
    await waitFor(() => expect(sent(calls, 'POST', '/attachments')).toBeDefined())
    expect((sent(calls, 'POST', '/attachments')!.body as FormData).get('file')).toHaveProperty('name', 'error-log.txt')

    // mileage-total.png was uploaded by Elyse, who is signed in.
    await userEvent.click(screen.getByRole('button', { name: 'Remove mileage-total.png' }))
    const confirm = await screen.findByRole('dialog', { name: 'Remove mileage-total.png?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(sent(calls, 'DELETE', '/attachments/9')).toBeDefined())
  })
})
