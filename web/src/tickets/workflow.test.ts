import { describe, expect, it } from 'vitest'
import { StatusIds } from './labels'
import { ticketActions } from './workflow'

// The workflow as seeded in src/BugTracker.Infrastructure/Data/SeedData.cs.
const allowed: Record<number, number[]> = {
  [StatusIds.New]: [StatusIds.Assigned, StatusIds.Triaged, StatusIds.WontFix],
  [StatusIds.Triaged]: [StatusIds.Assigned, StatusIds.WontFix],
  [StatusIds.Assigned]: [StatusIds.InProgress, StatusIds.Triaged],
  [StatusIds.InProgress]: [StatusIds.ReadyForTest, StatusIds.WontFix],
  [StatusIds.ReadyForTest]: [StatusIds.Verified, StatusIds.Reopened],
  [StatusIds.Verified]: [StatusIds.Closed],
  [StatusIds.Closed]: [StatusIds.Reopened],
  [StatusIds.WontFix]: [StatusIds.Reopened],
  [StatusIds.Reopened]: [StatusIds.InProgress, StatusIds.Assigned],
}

const labelsFor = (statusId: number, moves = allowed[statusId] ?? []) =>
  ticketActions({
    statusId,
    allowedTransitions: moves.map((to) => ({
      fromStatusId: statusId,
      toStatusId: to,
      requiresComment: false,
      requiresAssignee: false,
      requiresResolution: false,
    })),
  }).map((a) => a.label)

describe('ticket actions', () => {
  it.each([
    [StatusIds.New, ['Triage', 'Won’t Fix']],
    [StatusIds.Triaged, ['Assign', 'Won’t Fix']],
    [StatusIds.Assigned, ['Start work', 'Unassign']],
    [StatusIds.InProgress, ['Ready for Test', 'Won’t Fix']],
    [StatusIds.ReadyForTest, ['Mark Verified', 'Reopen']],
    [StatusIds.Verified, ['Close']],
    [StatusIds.Closed, ['Reopen']],
    [StatusIds.WontFix, ['Reopen']],
    [StatusIds.Reopened, ['Start work', 'Reassign']],
  ])('status %i offers %j', (status, expected) => {
    expect(labelsFor(status)).toEqual(expected)
  })

  it('hides a move the API no longer allows', () => {
    expect(labelsFor(StatusIds.ReadyForTest, [StatusIds.Verified])).toEqual(['Mark Verified'])
  })
})
