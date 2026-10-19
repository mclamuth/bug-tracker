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

/** RFC 9457 Problem Details, as returned by the API on errors. */
export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
}

/** A person's roles, in the order the dashboard uses them. */
export function roleLabel(user: Pick<UserDto, 'isDeveloper' | 'isIca' | 'isSupervisor'>): string {
  const roles = [user.isDeveloper && 'Developer', user.isIca && 'ICA', user.isSupervisor && 'ISSD Supervisor'].filter(
    Boolean,
  )
  return roles.length > 0 ? roles.join(' · ') : 'Team member'
}
