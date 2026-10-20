import type { TicketDetailDto } from '../api/types'
import { StatusIds } from './labels'

/** What a header button does: move straight to a status, open the status dialog, or open the assignment dialog. */
export type TicketAction =
  | { kind: 'move'; label: string; toStatusId: number; done: string }
  | { kind: 'dialog'; label: string; dialog: StatusDialogKind }
  | { kind: 'assign'; label: string }

export type StatusDialogKind = 'ready' | 'reopen' | 'wontfix'

const S = StatusIds

/** The buttons for each status, primary first, as in the Figma design. */
const byStatus: Record<number, TicketAction[]> = {
  [S.New]: [
    { kind: 'assign', label: 'Triage' },
    { kind: 'dialog', label: 'Won’t Fix', dialog: 'wontfix' },
  ],
  [S.Triaged]: [
    { kind: 'assign', label: 'Assign' },
    { kind: 'dialog', label: 'Won’t Fix', dialog: 'wontfix' },
  ],
  [S.Assigned]: [
    { kind: 'move', label: 'Start work', toStatusId: S.InProgress, done: 'Work started' },
    { kind: 'move', label: 'Unassign', toStatusId: S.Triaged, done: 'Ticket moved back to the backlog' },
  ],
  [S.InProgress]: [
    { kind: 'dialog', label: 'Ready for Test', dialog: 'ready' },
    { kind: 'dialog', label: 'Won’t Fix', dialog: 'wontfix' },
  ],
  [S.ReadyForTest]: [
    { kind: 'move', label: 'Mark Verified', toStatusId: S.Verified, done: 'Marked as verified' },
    { kind: 'dialog', label: 'Reopen', dialog: 'reopen' },
  ],
  [S.Verified]: [{ kind: 'move', label: 'Close', toStatusId: S.Closed, done: 'Ticket closed' }],
  [S.Closed]: [{ kind: 'dialog', label: 'Reopen', dialog: 'reopen' }],
  [S.WontFix]: [{ kind: 'dialog', label: 'Reopen', dialog: 'reopen' }],
  [S.Reopened]: [
    { kind: 'move', label: 'Start work', toStatusId: S.InProgress, done: 'Work started' },
    { kind: 'assign', label: 'Reassign' },
  ],
}

/** Where each status dialog goes. */
export const dialogTarget: Record<StatusDialogKind, number> = {
  ready: S.ReadyForTest,
  reopen: S.Reopened,
  wontfix: S.WontFix,
}

/** Statuses whose ticket can change hands (matches TicketService.AssignAsync). */
export function canAssign(statusId: number): boolean {
  return statusId !== S.Verified && statusId !== S.Closed && statusId !== S.WontFix
}

/**
 * The header buttons for this ticket. Each is checked against the moves the API says are allowed,
 * so the buttons never offer something the workflow would refuse.
 */
export function ticketActions(ticket: Pick<TicketDetailDto, 'statusId' | 'allowedTransitions'>): TicketAction[] {
  const allowed = new Set(ticket.allowedTransitions.map((t) => t.toStatusId))
  return (byStatus[ticket.statusId] ?? []).filter((a) =>
    a.kind === 'move'
      ? allowed.has(a.toStatusId)
      : a.kind === 'dialog'
        ? allowed.has(dialogTarget[a.dialog])
        : canAssign(ticket.statusId),
  )
}
