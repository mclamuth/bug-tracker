import type { ActivityDto, DashboardCountsDto, UserDto } from '../api/types'

export type DashboardRole = 'developer' | 'ica' | 'supervisor'
export type Tone = 'blue' | 'purple' | 'red' | 'amber'

export const roleNames: Record<DashboardRole, string> = {
  developer: 'Developer',
  ica: 'ICA',
  supervisor: 'Supervisor',
}

/** The views a person can switch between, their main role first (supervisor, then developer, then ICA). */
export function dashboardRoles(user: Pick<UserDto, 'isDeveloper' | 'isIca' | 'isSupervisor'>): DashboardRole[] {
  const roles: DashboardRole[] = []
  if (user.isSupervisor) roles.push('supervisor')
  if (user.isDeveloper) roles.push('developer')
  if (user.isIca) roles.push('ica')
  return roles.length > 0 ? roles : ['ica'] // anyone else reports and tests, like an ICA
}

export interface SummaryCard {
  label: string
  note: string
  count: (c: DashboardCountsDto) => number
  tone: Tone
  /** The ticket list showing exactly these tickets. */
  to: string
}

const openedThisWeek: SummaryCard = {
  label: 'Opened this week',
  note: 'Recently created tickets',
  count: (c) => c.openedThisWeek,
  tone: 'amber',
  to: '/tickets?view=all&sort=created&direction=desc',
}

const criticalOpen: SummaryCard = {
  label: 'Critical open',
  note: 'Across all applications',
  count: (c) => c.criticalOpen,
  tone: 'red',
  to: '/tickets?severity=Critical',
}

/** The four cards across the top of My Work for each role, as in the Figma design. */
export const summaryCards: Record<DashboardRole, SummaryCard[]> = {
  developer: [
    {
      label: 'Assigned to me',
      note: 'Open tickets assigned to you',
      count: (c) => c.assignedToMe,
      tone: 'blue',
      to: '/tickets?view=assigned-to-me',
    },
    {
      label: 'Reopened',
      note: 'Returned from testing',
      count: (c) => c.myReopened,
      tone: 'purple',
      to: '/tickets?view=assigned-to-me&statusId=8',
    },
    criticalOpen,
    openedThisWeek,
  ],
  ica: [
    {
      label: 'Ready for Test',
      note: 'Waiting for verification',
      count: (c) => c.readyForTest,
      tone: 'purple',
      to: '/tickets?statusId=5',
    },
    {
      label: 'Reported by me',
      note: 'Open tickets you submitted',
      count: (c) => c.reportedByMe,
      tone: 'blue',
      to: '/tickets?view=reported-by-me',
    },
    {
      label: 'Reopened',
      note: 'Testing follow-up needed',
      count: (c) => c.reopened,
      tone: 'red',
      to: '/tickets?statusId=8',
    },
    openedThisWeek,
  ],
  supervisor: [
    {
      label: 'Needs triage',
      note: 'New tickets awaiting review',
      count: (c) => c.needsTriage,
      tone: 'purple',
      to: '/tickets?statusId=1&sort=created&direction=asc',
    },
    {
      label: 'Unassigned',
      note: 'Open tickets without an owner',
      count: (c) => c.unassigned,
      tone: 'blue',
      to: '/tickets?view=unassigned',
    },
    criticalOpen,
    {
      label: 'Open by developer',
      note: 'Assigned development work',
      count: (c) => c.openWithDeveloper,
      tone: 'amber',
      to: '/tickets?sort=assignee&direction=asc',
    },
  ],
}

/** "moved BT-1037 to Ready for Test": the words after the person's name, split around the ticket number. */
export function activityWords(a: Pick<ActivityDto, 'kind' | 'oldValue' | 'newValue'>): {
  before: string
  after: string
} {
  switch (a.kind) {
    case 'created':
      return { before: 'reported', after: '' }
    case 'status':
      return { before: 'moved', after: `to ${a.newValue ?? 'a new status'}` }
    case 'assignee':
      return a.newValue ? { before: 'assigned', after: `to ${a.newValue}` } : { before: 'unassigned', after: '' }
    case 'comment':
      return { before: 'commented on', after: '' }
  }
}

const ROLE_KEY = 'bt.dashboardRole'

/** The view someone last chose, if it's still one of theirs. Browser storage can be missing or blocked. */
export function rememberedRole(roles: DashboardRole[]): DashboardRole {
  try {
    const saved = localStorage.getItem(ROLE_KEY) as DashboardRole | null
    if (saved && roles.includes(saved)) return saved
  } catch {
    // Private window or storage switched off: use the main role.
  }
  return roles[0]!
}

export function rememberRole(role: DashboardRole): void {
  try {
    localStorage.setItem(ROLE_KEY, role)
  } catch {
    // Not remembered; nothing else depends on it.
  }
}
