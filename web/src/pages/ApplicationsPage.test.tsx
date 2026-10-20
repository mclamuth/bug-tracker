import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { applications, directory, mockApi, renderAt, type ApiCall } from '../test/renderPage'
import { ApplicationsPage } from './ApplicationsPage'

const routes = [{ path: '/applications', element: <ApplicationsPage /> }]
const sent = (calls: ApiCall[], method: string, path: string) =>
  calls.find((c) => c.method === method && c.path === path)

describe('applications admin', () => {
  it('adds an application', async () => {
    const calls = mockApi(
      (call) =>
        call.method === 'POST' && call.path === '/api/v1/applications'
          ? { status: 201, body: { ...applications[0], id: 23, name: 'Payroll Corrections' } }
          : undefined,
      ...directory,
    )
    renderAt('/applications', routes)

    await userEvent.click(await screen.findByRole('button', { name: 'Add application' }))
    const drawer = await screen.findByRole('dialog', { name: /Add application/ })
    await userEvent.type(within(drawer).getByRole('textbox', { name: /Application name/ }), 'Payroll Corrections')
    await userEvent.type(within(drawer).getByRole('textbox', { name: /Description/ }), 'Payroll fixes')
    await userEvent.selectOptions(within(drawer).getByRole('combobox', { name: /Default assignee/ }), 'Hue Chi')
    await userEvent.type(within(drawer).getByRole('textbox', { name: /Launcher URL/ }), 'https://payroll.cta.org/')
    await userEvent.click(within(drawer).getByRole('button', { name: 'Add application' }))

    await waitFor(() => expect(sent(calls, 'POST', '/api/v1/applications')).toBeDefined())
    expect(sent(calls, 'POST', '/api/v1/applications')!.body).toEqual({
      name: 'Payroll Corrections',
      description: 'Payroll fixes',
      defaultAssigneeId: 3,
      launcherUrl: 'https://payroll.cta.org/',
      isActive: true,
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('checks the name and link before saving, and shows the server’s answer on the field', async () => {
    const calls = mockApi(
      (call) =>
        call.method === 'PUT'
          ? {
              status: 400,
              body: {
                title: 'Please correct the highlighted fields.',
                errors: { name: ['Another application already has this name.'] },
              },
            }
          : undefined,
      ...directory,
    )
    renderAt('/applications', routes)

    await userEvent.click(await screen.findByRole('row', { name: 'Staff Expense' }))
    const drawer = await screen.findByRole('dialog', { name: /Edit Staff Expense/ })
    const name = within(drawer).getByRole('textbox', { name: /Application name/ })
    await userEvent.clear(name)
    await userEvent.type(within(drawer).getByRole('textbox', { name: /Launcher URL/ }), 'expense.cta.org')
    await userEvent.click(within(drawer).getByRole('button', { name: 'Save changes' }))
    expect(within(drawer).getByText('Enter the application’s name.')).toBeInTheDocument()
    expect(within(drawer).getByText('Enter a full web address starting with https://')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'PUT')).toBe(false)

    await userEvent.type(name, 'Overtime')
    await userEvent.clear(within(drawer).getByRole('textbox', { name: /Launcher URL/ }))
    await userEvent.click(within(drawer).getByRole('button', { name: 'Save changes' }))
    expect(await within(drawer).findByText('Another application already has this name.')).toBeInTheDocument()
  })

  it('switches an application off from the list', async () => {
    const calls = mockApi(
      (call) => (call.method === 'PUT' ? { body: { ...applications[1], isActive: false } } : undefined),
      ...directory,
    )
    renderAt('/applications', routes)

    await userEvent.click(await screen.findByRole('switch', { name: 'Staff Expense is active' }))

    await waitFor(() => expect(sent(calls, 'PUT', '/api/v1/applications/19')).toBeDefined())
    expect(sent(calls, 'PUT', '/api/v1/applications/19')!.body).toMatchObject({
      name: 'Staff Expense',
      isActive: false,
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument() // the switch doesn't open the editor
  })
})
