import { describe, expect, it } from 'vitest'
import type { ApplicationDto } from '../api/types'
import { launcherApps } from './launcherApps'

const app = (id: number, name: string, launcherUrl: string | null, isActive = true): ApplicationDto => ({
  id,
  name,
  description: null,
  defaultAssigneeId: null,
  defaultAssigneeName: null,
  launcherUrl,
  isActive,
  openTickets: 0,
})

describe('launcherApps', () => {
  const apps = [
    app(1, 'Staff Expense', 'https://apps.cta.org/staff-expense'),
    app(2, 'Eboard', 'https://apps.cta.org/eboard'),
    app(3, 'RIF', null),
    app(4, 'Tire Request', 'https://apps.cta.org/tires', false),
  ]

  it('lists only active applications that have a link, A–Z', () => {
    expect(launcherApps(apps, '').map((a) => a.name)).toEqual(['Eboard', 'Staff Expense'])
  })

  it('filters by name, ignoring case and spaces', () => {
    expect(launcherApps(apps, '  STAFF ').map((a) => a.name)).toEqual(['Staff Expense'])
  })
})
