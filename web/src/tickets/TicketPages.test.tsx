import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { directory, get, listItem, mockApi, people, renderAt, ticketDetail } from '../test/renderPage'
import { NewTicketPage } from './NewTicketPage'
import { TicketDetailPage } from './TicketDetailPage'
import { TicketListPage } from './TicketListPage'

const routes = [
  { path: '/tickets', element: <TicketListPage /> },
  { path: '/tickets/new', element: <NewTicketPage /> },
  { path: '/tickets/:number', element: <TicketDetailPage /> },
]

const page = (items: unknown[], totalCount = items.length) => ({ items, totalCount, page: 1, pageSize: 25 })

describe('ticket list', () => {
  it('shows tickets with counts on the quick views, and opens a ticket from its row', async () => {
    mockApi(
      ...directory,
      get('/api/v1/tickets', page([listItem(1042, { title: 'Mileage doubles' }), listItem(1043, { assignee: null })])),
      get('/api/v1/tickets/1042', ticketDetail()),
      get('/api/v1/tickets/1042/history', []),
    )
    const router = renderAt('/tickets', routes)

    expect(await screen.findByRole('cell', { name: 'Mileage doubles' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Open\s*2/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('2 tickets')).toBeInTheDocument()
    expect(screen.getByText('Unassigned', { selector: 'span' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('cell', { name: 'Mileage doubles' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/tickets/1042'))
  })

  it('puts quick views, filters and sorting in the request and the URL', async () => {
    const calls = mockApi(...directory, get('/api/v1/tickets', page([listItem(1042)])))
    const router = renderAt('/tickets', routes)
    await screen.findByRole('cell', { name: 'Ticket 1042' })

    await userEvent.click(screen.getByRole('tab', { name: /Unassigned/ }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Severity' }), 'Critical')
    await userEvent.click(screen.getByRole('button', { name: 'Title' }))

    await waitFor(() =>
      expect(router.state.location.search).toBe('?view=unassigned&severity=Critical&sort=title&direction=asc'),
    )
    const last = calls.filter((c) => c.path.startsWith('/api/v1/tickets?')).at(-1)!
    expect(last.path).toContain('view=unassigned')
    expect(last.path).toContain('severity=Critical')
    expect(last.path).toContain('sort=title&direction=asc')
    expect(screen.getByRole('button', { name: 'Remove filter Critical' })).toBeInTheDocument()
  })

  it('offers to clear filters when nothing matches', async () => {
    mockApi(...directory, get('/api/v1/tickets', page([])))
    renderAt('/tickets?search=nothing', routes)

    expect(await screen.findByRole('heading', { name: 'No tickets found' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Clear filters' }).length).toBeGreaterThan(0)
  })
})

describe('new ticket form', () => {
  it('explains what is missing before sending anything', async () => {
    const calls = mockApi(...directory)
    renderAt('/tickets/new', routes)

    await userEvent.click(await screen.findByRole('button', { name: 'Create ticket' }))

    expect(screen.getByText('Select an application.')).toBeInTheDocument()
    expect(screen.getByText('Enter a concise title.')).toBeInTheDocument()
    expect(screen.getByText('Describe the issue or request.')).toBeInTheDocument()
    expect(screen.getByText('Select a severity.')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('defaults the assignee to the application’s developer and creates the ticket', async () => {
    const calls = mockApi(...directory, (call) =>
      call.method === 'POST' && call.path === '/api/v1/tickets'
        ? { status: 201, body: ticketDetail({ number: 1050, displayNumber: 'BT-1050' }) }
        : undefined,
    )
    const router = renderAt('/tickets/new', routes)
    await screen.findByRole('option', { name: 'Staff Expense' })
    expect(await screen.findByRole('option', { name: 'Unassigned — Ken will triage it' })).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /Application/ }), 'Staff Expense')
    expect(screen.getByRole('combobox', { name: /Assign to/ })).toHaveValue('1') // Max, Staff Expense's developer
    await userEvent.type(screen.getByRole('textbox', { name: /Title/ }), 'Mileage doubles')
    await userEvent.type(screen.getByRole('textbox', { name: /Description/ }), 'The total is twice what it should be.')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /Severity/ }), 'High')
    await userEvent.click(screen.getByRole('button', { name: 'Create ticket' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/tickets/1050'))
    expect(calls.find((c) => c.method === 'POST')!.body).toMatchObject({
      type: 'Defect',
      applicationId: 19,
      title: 'Mileage doubles',
      description: 'The total is twice what it should be.',
      severity: 'High',
      environment: 'Production',
      priority: 'P3Normal',
      assigneeId: 1,
    })
  })

  it('attaches chosen files after creating, then shows the ticket with them', async () => {
    const calls = mockApi(
      ...directory,
      (call) =>
        call.method === 'POST' && call.path === '/api/v1/tickets'
          ? { status: 201, body: ticketDetail({ number: 1052, attachments: [] }) }
          : undefined,
      (call) => (call.method === 'POST' && call.path.endsWith('/attachments') ? { status: 201, body: {} } : undefined),
      get('/api/v1/tickets/1052', ticketDetail({ number: 1052 })),
      get('/api/v1/tickets/1052/history', []),
    )
    renderAt('/tickets/new', routes)
    await screen.findByRole('option', { name: 'Staff Expense' })

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /Application/ }), 'Staff Expense')
    await userEvent.type(screen.getByRole('textbox', { name: /Title/ }), 'With a screenshot')
    await userEvent.type(screen.getByRole('textbox', { name: /Description/ }), 'See the attached screenshot.')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /Severity/ }), 'Low')
    const input = document.querySelector<HTMLInputElement>('input[type=file]')!
    await userEvent.upload(input, [
      new File(['png'], 'mileage-total.png', { type: 'image/png' }),
      new File(['x'], 'setup.exe', { type: 'application/octet-stream' }),
    ])
    expect(screen.getByText('mileage-total.png')).toBeInTheDocument()
    expect(screen.getByText('setup.exe isn’t a supported file type.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Create ticket' }))

    // The detail page shows the file, from a fresh read after the upload.
    expect(await screen.findByText('PNG · 284 KB')).toBeInTheDocument()
    const uploads = calls.filter((c) => c.path.endsWith('/attachments'))
    expect(uploads).toHaveLength(1)
    expect((uploads[0]!.body as FormData).get('file')).toHaveProperty('name', 'mileage-total.png')
    expect(calls.filter((c) => c.method === 'GET' && c.path === '/api/v1/tickets/1052').length).toBeGreaterThan(0)
  })

  it('sends no defect-only fields for an enhancement', async () => {
    const calls = mockApi(...directory, (call) =>
      call.method === 'POST' ? { status: 201, body: ticketDetail({ number: 1051 }) } : undefined,
    )
    renderAt('/tickets/new', routes)
    await screen.findByRole('option', { name: 'Staff Expense' })

    await userEvent.click(screen.getByRole('radio', { name: 'Enhancement' }))
    expect(screen.queryByRole('heading', { name: 'Reproduction details' })).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /Application/ }), 'Overtime')
    await userEvent.type(screen.getByRole('textbox', { name: /Title/ }), 'Export to Excel')
    await userEvent.type(screen.getByRole('textbox', { name: /Description/ }), 'Let managers export the list.')
    await userEvent.click(screen.getByRole('button', { name: 'Create ticket' }))

    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true))
    expect(calls.find((c) => c.method === 'POST')!.body).toMatchObject({
      type: 'Enhancement',
      severity: null,
      environment: null,
      stepsToReproduce: null,
      assigneeId: 3, // Hue, Overtime's developer
    })
  })

  it('shows the server’s validation messages on the fields', async () => {
    mockApi(...directory, (call) =>
      call.method === 'POST'
        ? {
            status: 400,
            body: {
              title: 'Please correct the highlighted fields.',
              errors: { title: ['Keep the title under 200 characters.'] },
            },
          }
        : undefined,
    )
    renderAt('/tickets/new', routes)
    await screen.findByRole('option', { name: 'Staff Expense' })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /Application/ }), 'Staff Expense')
    await userEvent.type(screen.getByRole('textbox', { name: /Title/ }), 'A title')
    await userEvent.type(screen.getByRole('textbox', { name: /Description/ }), 'Details')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /Severity/ }), 'Low')
    await userEvent.click(screen.getByRole('button', { name: 'Create ticket' }))

    expect(await screen.findByText('Keep the title under 200 characters.')).toBeInTheDocument()
  })
})

describe('ticket detail', () => {
  const detailApi = (...extra: Parameters<typeof mockApi>) =>
    mockApi(
      ...extra,
      ...directory,
      get('/api/v1/tickets/1042', ticketDetail()),
      get('/api/v1/tickets/1042/history', [
        {
          id: 1,
          changedBy: people.ken,
          changedAt: '2026-10-19T12:00:00Z',
          fieldName: 'Assignee',
          oldValue: null,
          newValue: 'Max Caber',
        },
      ]),
    )

  it('shows the report, files, comments with mentions, history and details', async () => {
    detailApi()
    renderAt('/tickets/1042', routes)

    expect(
      await screen.findByRole('heading', { name: 'Mileage total doubles when a trip is edited' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Diane Cole, Membership')).toBeInTheDocument()
    expect(screen.getByText('Old and new amounts are added')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mileage-total\.png/ })).toBeInTheDocument()
    expect(screen.getByText('@Elyse Orris')).toBeInTheDocument()
    expect(await screen.findByText('assigned the ticket to Max Caber')).toBeInTheDocument()

    const details = screen.getByRole('complementary', { name: 'Details' })
    expect(within(details).getByText('P2 High')).toBeInTheDocument()
    expect(within(details).getByText('Elyse Orris')).toBeInTheDocument()
  })

  it('saves only the changed details, with the version it read', async () => {
    const calls = detailApi((call) =>
      call.method === 'PATCH'
        ? { body: ticketDetail({ priority: 'P1Urgent', rowVersion: 'AAAAAAAAB9I=' }) }
        : undefined,
    )
    renderAt('/tickets/1042', routes)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'P1 Urgent')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true))
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ rowVersion: 'AAAAAAAAB9E=', priority: 'P1Urgent' })
    // The panel closes once the new version arrives.
    expect(await screen.findByRole('button', { name: 'Edit details' })).toBeInTheDocument()
  })

  it('warns when someone else changed the ticket first', async () => {
    detailApi((call) =>
      call.method === 'PATCH'
        ? { status: 409, body: { title: 'Someone else updated this ticket. Reload to see the latest changes.' } }
        : undefined,
    )
    renderAt('/tickets/1042', routes)
    await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'P4 Low')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Someone else updated this ticket.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('adds a comment, with a teammate picked from the @mention list', async () => {
    const calls = detailApi((call) =>
      call.method === 'POST' && call.path.endsWith('/comments') ? { status: 201, body: { id: 77 } } : undefined,
    )
    renderAt('/tickets/1042', routes)
    const box = await screen.findByRole('combobox', { name: 'Add a comment' })
    await userEvent.type(box, 'Retested, thanks @Ma')

    const list = await screen.findByRole('listbox', { name: 'Mention a teammate' })
    expect(within(list).getByRole('option', { name: /Max Caber/ })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{Enter}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await userEvent.type(box, '— looks good.')
    await userEvent.click(screen.getByRole('button', { name: 'Add comment' }))

    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/comments'))).toBe(true))
    expect(calls.find((c) => c.path.endsWith('/comments'))!.body).toEqual({
      body: 'Retested, thanks @Max Caber — looks good.',
    })
  })

  it('explains when the address isn’t a ticket number', async () => {
    mockApi(...directory, get('/api/v1/tickets/1042', ticketDetail()), get('/api/v1/tickets/1042/history', []))
    renderAt('/tickets/abc', routes)
    expect(await screen.findByRole('heading', { name: '“abc” isn’t a ticket number' })).toBeInTheDocument()
  })

  it('opens /tickets/BT-1042', async () => {
    mockApi(...directory, get('/api/v1/tickets/1042', ticketDetail()), get('/api/v1/tickets/1042/history', []))
    renderAt('/tickets/BT-1042', routes)
    expect(
      await screen.findByRole('heading', { name: 'Mileage total doubles when a trip is edited' }),
    ).toBeInTheDocument()
  })

  it('says so when the ticket doesn’t exist', async () => {
    mockApi(...directory)
    renderAt('/tickets/999', routes)
    expect(await screen.findByRole('heading', { name: 'BT-999 doesn’t exist' })).toBeInTheDocument()
  })
})
