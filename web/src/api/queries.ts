import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiSend } from './client'
import type {
  ApplicationDto,
  AttachmentDto,
  CommentDto,
  CreateTicketRequest,
  HistoryEntryDto,
  LookupsDto,
  TicketDetailDto,
  TicketListParams,
  TicketPageDto,
  TicketViewCountsDto,
  UpdateTicketRequest,
  UserDto,
} from './types'

export const queryKeys = {
  me: ['me'] as const,
  users: (role?: string) => ['users', role ?? 'all'] as const,
  applications: ['applications'] as const,
  lookups: ['lookups'] as const,
  tickets: ['tickets'] as const,
  ticketList: (params: TicketListParams) => ['tickets', 'list', params] as const,
  ticketCounts: ['tickets', 'counts'] as const,
  ticket: (number: number) => ['tickets', 'detail', number] as const,
  ticketHistory: (number: number) => ['tickets', 'detail', number, 'history'] as const,
}

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: () => apiFetch<UserDto>('/api/v1/me') })
}

export function useUsers(role?: 'developer' | 'ica' | 'supervisor') {
  return useQuery({
    queryKey: queryKeys.users(role),
    queryFn: () => apiFetch<UserDto[]>(role ? `/api/v1/users?role=${role}` : '/api/v1/users'),
    staleTime: 10 * 60 * 1000,
  })
}

export function useApplications() {
  return useQuery({
    queryKey: queryKeys.applications,
    queryFn: () => apiFetch<ApplicationDto[]>('/api/v1/applications'),
  })
}

export function useLookups() {
  return useQuery({
    queryKey: queryKeys.lookups,
    queryFn: () => apiFetch<LookupsDto>('/api/v1/lookups'),
    staleTime: 60 * 60 * 1000, // The workflow rarely changes.
  })
}

// ---------- Tickets ----------

/** Builds the query string for GET /tickets, leaving out empty values. */
export function ticketListQuery(params: TicketListParams): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  return query.toString()
}

export function useTicketList(params: TicketListParams) {
  return useQuery({
    queryKey: queryKeys.ticketList(params),
    queryFn: () => apiFetch<TicketPageDto>(`/api/v1/tickets?${ticketListQuery(params)}`),
    // Keep showing the current rows while the next page or sort loads.
    placeholderData: keepPreviousData,
  })
}

export function useTicketCounts() {
  return useQuery({
    queryKey: queryKeys.ticketCounts,
    queryFn: () => apiFetch<TicketViewCountsDto>('/api/v1/tickets/counts'),
  })
}

export function useTicket(number: number) {
  return useQuery({
    queryKey: queryKeys.ticket(number),
    queryFn: () => apiFetch<TicketDetailDto>(`/api/v1/tickets/${number}`),
    enabled: Number.isInteger(number) && number > 0,
  })
}

export function useTicketHistory(number: number) {
  return useQuery({
    queryKey: queryKeys.ticketHistory(number),
    queryFn: () => apiFetch<HistoryEntryDto[]>(`/api/v1/tickets/${number}/history`),
    enabled: Number.isInteger(number) && number > 0,
  })
}

/** After any change to a ticket: lists, counts and that ticket's history are out of date. */
function useTicketChanged() {
  const client = useQueryClient()
  return (ticket?: TicketDetailDto) => {
    if (ticket) client.setQueryData(queryKeys.ticket(ticket.number), ticket)
    void client.invalidateQueries({ queryKey: ['tickets', 'list'] })
    void client.invalidateQueries({ queryKey: queryKeys.ticketCounts })
    void client.invalidateQueries({ queryKey: queryKeys.applications }) // open-ticket counts
    if (ticket) void client.invalidateQueries({ queryKey: queryKeys.ticketHistory(ticket.number) })
  }
}

export function useCreateTicket() {
  const changed = useTicketChanged()
  return useMutation({
    mutationFn: (request: CreateTicketRequest) => apiSend<TicketDetailDto>('/api/v1/tickets', 'POST', request),
    onSuccess: (ticket) => changed(ticket),
  })
}

export function useUpdateTicket(number: number) {
  const changed = useTicketChanged()
  return useMutation({
    mutationFn: (request: UpdateTicketRequest) =>
      apiSend<TicketDetailDto>(`/api/v1/tickets/${number}`, 'PATCH', request),
    onSuccess: (ticket) => changed(ticket),
  })
}

export function useAddComment(number: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => apiSend<CommentDto>(`/api/v1/tickets/${number}/comments`, 'POST', { body }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.ticket(number) })
      void client.invalidateQueries({ queryKey: ['tickets', 'list'] }) // last updated
    },
  })
}

/** Uploads one file to a ticket. */
export function uploadAttachment(number: number, file: File): Promise<AttachmentDto> {
  const form = new FormData()
  form.append('file', file)
  return apiFetch<AttachmentDto>(`/api/v1/tickets/${number}/attachments`, { method: 'POST', body: form })
}
