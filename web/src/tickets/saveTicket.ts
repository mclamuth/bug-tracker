import { ApiError } from '../api/client'
import type { TicketDetailDto, UpdateTicketRequest } from '../api/types'

/**
 * Runs a change to a ticket. Returns true when it worked; on a 409 (someone else changed the ticket, or its
 * status moved on) the page shows the "someone else updated" banner. Validation and other errors are left on
 * the mutation for the caller to show.
 */
export async function tryTicketChange(run: () => Promise<unknown>, onConflict: () => void): Promise<boolean> {
  try {
    await run()
    return true
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) onConflict()
    return false
  }
}

/** Sends an edit to the ticket's fields. */
export function saveTicket(
  mutate: (request: UpdateTicketRequest) => Promise<TicketDetailDto>,
  request: UpdateTicketRequest,
  onConflict: () => void,
): Promise<boolean> {
  return tryTicketChange(() => mutate(request), onConflict)
}

/** The validation message to show for a failed mutation (400), or a general one for anything but a 409. */
export function problemText(error: unknown): string | null {
  if (!error) return null
  if (error instanceof ApiError) {
    if (error.status === 409) return null
    if (error.status === 400) return Object.values(error.fieldErrors).join(' ') || error.message
  }
  return (error as Error).message
}
