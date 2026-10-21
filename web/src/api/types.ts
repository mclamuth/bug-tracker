// Shapes returned by the API. Kept in step with src/BugTracker.Application/Dtos.cs.

export interface UserDto {
  id: number
  displayName: string
  email: string
  initials: string
  isDeveloper: boolean
  isIca: boolean
  isSupervisor: boolean
}

export interface ApplicationDto {
  id: number
  name: string
  description: string | null
  defaultAssigneeId: number | null
  defaultAssigneeName: string | null
  launcherUrl: string | null
  isActive: boolean
  openTickets: number
}

export interface StatusDto {
  id: number
  name: string
  sortOrder: number
  isClosed: boolean
}

export interface TransitionDto {
  fromStatusId: number
  toStatusId: number
  requiresComment: boolean
  requiresAssignee: boolean
  requiresResolution: boolean
}

export interface OptionDto {
  value: string
  label: string
}

export interface LookupsDto {
  statuses: StatusDto[]
  transitions: TransitionDto[]
  ticketTypes: OptionDto[]
  severities: OptionDto[]
  priorities: OptionDto[]
  environments: OptionDto[]
  resolutions: OptionDto[]
}

export interface AuthConfigDto {
  mode: 'Development' | 'Entra'
  tenantId: string | null
  clientId: string | null
  apiScope: string | null
}

/** RFC 9457 Problem Details, as returned by the API on errors. Validation errors are keyed by camelCase field. */
export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  errors?: Record<string, string[]>
}

// ---------- Tickets (src/BugTracker.Application/Tickets/TicketDtos.cs) ----------

export type TicketType = 'Defect' | 'Enhancement'
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low'
export type Priority = 'P1Urgent' | 'P2High' | 'P3Normal' | 'P4Low'
export type TicketEnvironment = 'Production' | 'Test' | 'Development'
export type Resolution = 'Fixed' | 'Implemented' | 'WontFix' | 'Duplicate' | 'CannotReproduce' | 'ByDesign'

export interface PersonDto {
  id: number
  displayName: string
  initials: string
}

export interface TicketListItemDto {
  number: number
  displayNumber: string
  type: TicketType
  title: string
  applicationId: number
  applicationName: string
  severity: Severity | null
  priority: Priority
  statusId: number
  statusName: string
  assignee: PersonDto | null
  reporter: PersonDto
  createdAt: string
  updatedAt: string
}

export interface TicketPageDto {
  items: TicketListItemDto[]
  totalCount: number
  page: number
  pageSize: number
}

export interface TicketViewCountsDto {
  open: number
  unassigned: number
  assignedToMe: number
  reportedByMe: number
  closed: number
  all: number
}

export interface CommentDto {
  id: number
  author: PersonDto
  body: string
  mentions: PersonDto[]
  createdAt: string
  editedAt: string | null
}

export interface AttachmentDto {
  id: number
  fileName: string
  contentType: string
  sizeBytes: number
  commentId: number | null
  uploadedBy: PersonDto
  uploadedAt: string
}

export interface HistoryEntryDto {
  id: number
  changedBy: PersonDto
  changedAt: string
  fieldName: string
  oldValue: string | null
  newValue: string | null
}

export interface TicketDetailDto {
  number: number
  displayNumber: string
  type: TicketType
  title: string
  description: string
  endUserName: string | null
  stepsToReproduce: string | null
  expectedResult: string | null
  actualResult: string | null
  environment: TicketEnvironment | null
  severity: Severity | null
  priority: Priority
  applicationId: number
  applicationName: string
  statusId: number
  statusName: string
  isClosed: boolean
  resolution: Resolution | null
  duplicateOfNumber: number | null
  assignee: PersonDto | null
  reporter: PersonDto
  /** yyyy-MM-dd */
  dueDate: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  rowVersion: string
  allowedTransitions: TransitionDto[]
  comments: CommentDto[]
  attachments: AttachmentDto[]
}

export interface CreateTicketRequest {
  type: TicketType
  applicationId: number | null
  title: string
  description: string
  endUserName?: string | null
  stepsToReproduce?: string | null
  expectedResult?: string | null
  actualResult?: string | null
  environment?: TicketEnvironment | null
  severity?: Severity | null
  priority: Priority
  assigneeId?: number | null
}

/** Only the fields sent are changed; rowVersion is the value from the last read. */
export interface UpdateTicketRequest {
  rowVersion: string
  applicationId?: number
  title?: string
  description?: string
  endUserName?: string | null
  stepsToReproduce?: string | null
  expectedResult?: string | null
  actualResult?: string | null
  environment?: TicketEnvironment | null
  severity?: Severity | null
  priority?: Priority
  dueDate?: string | null
}

// ---------- My Work (src/BugTracker.Application/Tickets/DashboardService.cs) ----------

export interface DashboardCountsDto {
  assignedToMe: number
  myReopened: number
  criticalOpen: number
  openedThisWeek: number
  readyForTest: number
  reportedByMe: number
  reopened: number
  needsTriage: number
  unassigned: number
  openWithDeveloper: number
  activeDevelopment: number
}

export interface WorkloadDto {
  developer: PersonDto
  assigned: number
  inProgress: number
  reopened: number
}

export interface ActivityDto {
  kind: 'created' | 'status' | 'assignee' | 'comment'
  by: PersonDto
  at: string
  ticketNumber: number
  ticketTitle: string
  oldValue: string | null
  newValue: string | null
}

export interface DashboardDto {
  counts: DashboardCountsDto
  myActive: TicketListItemDto[]
  readyForTest: TicketListItemDto[]
  reportedByMe: TicketListItemDto[]
  needsTriage: TicketListItemDto[]
  workload: WorkloadDto[]
  recentActivity: ActivityDto[]
}

export interface TransitionRequest {
  toStatusId: number
  comment?: string | null
  resolution?: Resolution | null
  duplicateOfNumber?: number | null
  assigneeId?: number | null
  rowVersion: string
}

export interface AssignRequest {
  assigneeId: number
  comment?: string | null
  rowVersion: string
}

export interface SaveApplicationRequest {
  name: string
  description: string | null
  defaultAssigneeId: number | null
  launcherUrl: string | null
  isActive: boolean
}

/** Filters, sort and page for the ticket list; every field maps to a query-string parameter of GET /tickets. */
export interface TicketListParams {
  view: TicketView
  type?: TicketType
  statusId?: number
  applicationId?: number
  assigneeId?: number
  severity?: Severity
  priority?: Priority
  search?: string
  sort?: TicketSort
  direction?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export type TicketView = 'open' | 'unassigned' | 'assigned-to-me' | 'reported-by-me' | 'closed' | 'all'
export type TicketSort =
  'number' | 'title' | 'application' | 'severity' | 'priority' | 'status' | 'assignee' | 'created' | 'updated'

/** A person's roles, in the order the dashboard uses them. */
export function roleLabel(user: Pick<UserDto, 'isDeveloper' | 'isIca' | 'isSupervisor'>): string {
  const roles = [user.isDeveloper && 'Developer', user.isIca && 'ICA', user.isSupervisor && 'ISSD Supervisor'].filter(
    Boolean,
  )
  return roles.length > 0 ? roles.join(' · ') : 'Team member'
}
