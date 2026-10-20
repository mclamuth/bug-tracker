import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiSend } from './client'
import type {
  ApplicationDto,
  AssignRequest,
  DashboardDto,
  AttachmentDto,
  CommentDto,
  CreateTicketRequest,
  HistoryEntryDto,
  LookupsDto,
  SaveApplicationRequest,
  TicketDetailDto,
  TicketListParams,
  TicketPageDto,
  TicketViewCountsDto,
  TransitionRequest,
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
  dashboard: ['tickets', 'dashboard'] as const,
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

/** Everything on My Work. Refreshed when you come back to the tab and every couple of minutes while it's open. */
export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => apiFetch<DashboardDto>('/api/v1/dashboard'),
    refetchInterval: 2 * 60 * 1000,
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
    void client.invalidateQueries({ queryKey: queryKeys.dashboard })
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

/** Change status: Start work, Ready for Test, Won't Fix, Reopen… */
export function useTransitionTicket(number: number) {
  const changed = useTicketChanged()
  return useMutation({
    mutationFn: (request: TransitionRequest) =>
      apiSend<TicketDetailDto>(`/api/v1/tickets/${number}/transitions`, 'POST', request),
    onSuccess: (ticket) => changed(ticket),
  })
}

/** Assign or reassign to a developer. */
export function useAssignTicket(number: number) {
  const changed = useTicketChanged()
  return useMutation({
    mutationFn: (request: AssignRequest) =>
      apiSend<TicketDetailDto>(`/api/v1/tickets/${number}/assignee`, 'PUT', request),
    onSuccess: (ticket) => changed(ticket),
  })
}

/** After a comment or file changes: the ticket (and its history) and the list's "last updated" are out of date. */
function useTicketContentChanged(number: number) {
  const client = useQueryClient()
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.ticket(number) }), // includes its history
      client.invalidateQueries({ queryKey: ['tickets', 'list'] }),
      client.invalidateQueries({ queryKey: queryKeys.dashboard }),
    ])
}

/** Adds a comment, then attaches any files to it. Resolves with the names of files that failed to upload. */
export function useAddComment(number: number) {
  const changed = useTicketContentChanged(number)
  return useMutation({
    mutationFn: async ({ body, files = [] }: { body: string; files?: File[] }) => {
      const comment = await apiSend<CommentDto>(`/api/v1/tickets/${number}/comments`, 'POST', { body })
      return { comment, failed: await uploadAll(number, files, comment.id) }
    },
    onSettled: changed,
  })
}

export function useEditComment(number: number) {
  const changed = useTicketContentChanged(number)
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      apiSend<CommentDto>(`/api/v1/comments/${id}`, 'PUT', { body }),
    onSuccess: changed,
  })
}

export function useDeleteComment(number: number) {
  const changed = useTicketContentChanged(number)
  return useMutation({
    mutationFn: (id: number) => apiSend<void>(`/api/v1/comments/${id}`, 'DELETE'),
    onSuccess: changed,
  })
}

/** Uploads files to the ticket one at a time. Resolves with the names of any that failed. */
export function useUploadAttachments(number: number) {
  const changed = useTicketContentChanged(number)
  return useMutation({
    mutationFn: (files: File[]) => uploadAll(number, files),
    onSettled: changed,
  })
}

export function useDeleteAttachment(number: number) {
  const changed = useTicketContentChanged(number)
  return useMutation({
    mutationFn: (id: number) => apiSend<void>(`/api/v1/attachments/${id}`, 'DELETE'),
    onSuccess: changed,
  })
}

/** Uploads one file to a ticket, optionally as part of a comment. */
export function uploadAttachment(number: number, file: File, commentId?: number): Promise<AttachmentDto> {
  const form = new FormData()
  form.append('file', file)
  if (commentId !== undefined) form.append('commentId', String(commentId))
  return apiFetch<AttachmentDto>(`/api/v1/tickets/${number}/attachments`, { method: 'POST', body: form })
}

async function uploadAll(number: number, files: File[], commentId?: number): Promise<string[]> {
  const failed: string[] = []
  for (const file of files) {
    try {
      await uploadAttachment(number, file, commentId)
    } catch {
      failed.push(file.name)
    }
  }
  return failed
}

// ---------- Applications admin ----------

/** Adds an application (no id) or saves changes to one. */
export function useSaveApplication() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...request }: SaveApplicationRequest & { id?: number }) =>
      id === undefined
        ? apiSend<ApplicationDto>('/api/v1/applications', 'POST', request)
        : apiSend<ApplicationDto>(`/api/v1/applications/${id}`, 'PUT', request),
    onSuccess: () => void client.invalidateQueries({ queryKey: queryKeys.applications }),
  })
}
