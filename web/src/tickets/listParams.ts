import type { Priority, Severity, TicketListParams, TicketSort, TicketType, TicketView } from '../api/types'
import { priorities, severities, ticketTypes } from './labels'

export const PAGE_SIZE = 25

export const views: { value: TicketView; label: string; countKey: CountKey }[] = [
  { value: 'open', label: 'Open', countKey: 'open' },
  { value: 'unassigned', label: 'Unassigned', countKey: 'unassigned' },
  { value: 'assigned-to-me', label: 'Assigned to me', countKey: 'assignedToMe' },
  { value: 'reported-by-me', label: 'Reported by me', countKey: 'reportedByMe' },
  { value: 'closed', label: 'Closed', countKey: 'closed' },
  { value: 'all', label: 'All', countKey: 'all' },
]
type CountKey = 'open' | 'unassigned' | 'assignedToMe' | 'reportedByMe' | 'closed' | 'all'

const sorts: TicketSort[] = [
  'number',
  'title',
  'application',
  'severity',
  'priority',
  'status',
  'assignee',
  'created',
  'updated',
]

/** Sorts where the natural first click is newest or highest first. */
const descendingFirst: TicketSort[] = ['number', 'created', 'updated']

const sortLabels: Record<TicketSort, string> = {
  number: 'Ticket #',
  title: 'Title',
  application: 'Application',
  severity: 'Severity',
  priority: 'Priority',
  status: 'Status',
  assignee: 'Assignee',
  created: 'Created',
  updated: 'Last updated',
}

const positiveInt = (value: string | null) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : undefined
}
const oneOf = <T extends string>(value: string | null, allowed: readonly T[]) =>
  allowed.includes(value as T) ? (value as T) : undefined

/** Reads the list's state from the URL, ignoring anything unrecognised. */
export function readListParams(search: URLSearchParams): TicketListParams {
  const sort = oneOf(search.get('sort'), sorts) ?? 'updated'
  return {
    view:
      oneOf(
        search.get('view'),
        views.map((v) => v.value),
      ) ?? 'open',
    type: oneOf<TicketType>(
      search.get('type'),
      ticketTypes.map((t) => t.value),
    ),
    statusId: positiveInt(search.get('statusId')),
    applicationId: positiveInt(search.get('applicationId')),
    assigneeId: positiveInt(search.get('assigneeId')),
    severity: oneOf<Severity>(
      search.get('severity'),
      severities.map((s) => s.value),
    ),
    priority: oneOf<Priority>(
      search.get('priority'),
      priorities.map((p) => p.value),
    ),
    search: search.get('search')?.trim() || undefined,
    sort,
    direction: oneOf(search.get('direction'), ['asc', 'desc'] as const) ?? defaultDirection(sort),
    page: positiveInt(search.get('page')) ?? 1,
    pageSize: PAGE_SIZE,
  }
}

/** Writes the list's state back to the URL, leaving out defaults so links stay short. */
export function writeListParams(params: TicketListParams): URLSearchParams {
  const out = new URLSearchParams()
  if (params.view !== 'open') out.set('view', params.view)
  const optional = ['type', 'statusId', 'applicationId', 'assigneeId', 'severity', 'priority', 'search'] as const
  for (const key of optional) {
    const value = params[key]
    if (value !== undefined && value !== '') out.set(key, String(value))
  }
  const sort = params.sort ?? 'updated'
  if (sort !== 'updated' || params.direction !== defaultDirection(sort)) {
    out.set('sort', sort)
    out.set('direction', params.direction ?? defaultDirection(sort))
  }
  if (params.page && params.page > 1) out.set('page', String(params.page))
  return out
}

export function defaultDirection(sort: TicketSort): 'asc' | 'desc' {
  return descendingFirst.includes(sort) ? 'desc' : 'asc'
}

/** Clicking a column: the same column flips direction, a new column starts at its natural direction. */
export function nextSort(params: TicketListParams, sort: TicketSort): Pick<TicketListParams, 'sort' | 'direction'> {
  if (params.sort === sort) return { sort, direction: params.direction === 'asc' ? 'desc' : 'asc' }
  return { sort, direction: defaultDirection(sort) }
}

/** "Last updated (newest first)", "Title (A–Z)", "Severity (highest first)". */
export function describeSort(sort: TicketSort, direction: 'asc' | 'desc'): string {
  const asc = direction === 'asc'
  const order =
    sort === 'number' || sort === 'created' || sort === 'updated'
      ? asc
        ? 'oldest first'
        : 'newest first'
      : sort === 'severity' || sort === 'priority'
        ? asc
          ? 'highest first'
          : 'lowest first'
        : sort === 'status'
          ? asc
            ? 'workflow order'
            : 'reverse workflow order'
          : asc
            ? 'A–Z'
            : 'Z–A'
  return `${sortLabels[sort]} (${order})`
}

/** True when any filter beyond the quick view is set. */
export function hasFilters(params: TicketListParams): boolean {
  return Boolean(
    params.type ||
    params.statusId ||
    params.applicationId ||
    params.assigneeId ||
    params.severity ||
    params.priority ||
    params.search,
  )
}
