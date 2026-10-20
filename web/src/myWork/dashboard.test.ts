import { describe, expect, it } from 'vitest'
import { readListParams } from '../tickets/listParams'
import { activityWords, dashboardRoles, rememberedRole, rememberRole, summaryCards } from './dashboard'

const roles = (isDeveloper: boolean, isIca: boolean, isSupervisor: boolean) =>
  dashboardRoles({ isDeveloper, isIca, isSupervisor })

describe('dashboard roles', () => {
  it('puts the main role first', () => {
    expect(roles(true, false, false)).toEqual(['developer'])
    expect(roles(true, true, false)).toEqual(['developer', 'ica']) // Michael
    expect(roles(false, false, true)).toEqual(['supervisor']) // Ken
    expect(roles(false, false, false)).toEqual(['ica'])
  })

  it('remembers the chosen view, but only if it is still one of theirs', () => {
    rememberRole('ica')
    expect(rememberedRole(['developer', 'ica'])).toBe('ica')
    expect(rememberedRole(['supervisor'])).toBe('supervisor')
  })
})

describe('summary cards', () => {
  it('has four cards per role, each linking to a valid ticket list', () => {
    for (const cards of Object.values(summaryCards)) {
      expect(cards).toHaveLength(4)
      for (const card of cards) {
        const [path, query = ''] = card.to.split('?')
        expect(path).toBe('/tickets')
        // Every parameter in the link is one the list understands.
        const params = readListParams(new URLSearchParams(query))
        for (const key of new URLSearchParams(query).keys()) {
          expect(params[key as keyof typeof params], `${card.label}: ${key}`).toBeDefined()
        }
      }
    }
  })
})

describe('activity words', () => {
  it.each([
    [{ kind: 'created', oldValue: null, newValue: 'New' }, 'reported'],
    [{ kind: 'status', oldValue: 'In Progress', newValue: 'Ready for Test' }, 'moved … to Ready for Test'],
    [{ kind: 'assignee', oldValue: null, newValue: 'Max Caber' }, 'assigned … to Max Caber'],
    [{ kind: 'assignee', oldValue: 'Max Caber', newValue: null }, 'unassigned'],
    [{ kind: 'comment', oldValue: null, newValue: null }, 'commented on'],
  ] as const)('%j', (activity, expected) => {
    const { before, after } = activityWords(activity)
    expect(after ? `${before} … ${after}` : before).toBe(expected)
  })
})
