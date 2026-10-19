import { ApiError } from '../api/client'
import type { TicketDetailDto, UpdateTicketRequest } from '../api/types'

/**
 * Sends an edit. Returns true when saved; on a 409 the page shows the "someone else updated" banner.
 * Validation and other errors are left on the mutation for the caller to show.
 */
export async function saveTicket(
  mutate: (request: UpdateTicketRequest) => Promise<TicketDetailDto>,
  request: UpdateTicketRequest,
  onConflict: () => void,
): Promise<boolean> {
  try {
    await mutate(request)
    return true
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) onConflict()
    return false
  }
}
