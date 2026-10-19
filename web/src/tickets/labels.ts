import type { Priority, Resolution, Severity, TicketEnvironment, TicketType } from '../api/types'

// Labels for the fixed value sets, matching DisplayNames in src/BugTracker.Application/DirectoryService.cs.

export const ticketTypes: { value: TicketType; label: string }[] = [
  { value: 'Defect', label: 'Defect' },
  { value: 'Enhancement', label: 'Enhancement' },
]

export const severities: { value: Severity; label: string }[] = [
  { value: 'Critical', label: 'Critical' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
]

export const priorities: { value: Priority; label: string }[] = [
  { value: 'P1Urgent', label: 'P1 Urgent' },
  { value: 'P2High', label: 'P2 High' },
  { value: 'P3Normal', label: 'P3 Normal' },
  { value: 'P4Low', label: 'P4 Low' },
]

export const environments: { value: TicketEnvironment; label: string }[] = [
  { value: 'Production', label: 'Production' },
  { value: 'Test', label: 'Test' },
  { value: 'Development', label: 'Development' },
]

const resolutionLabels: Record<Resolution, string> = {
  Fixed: 'Fixed',
  Implemented: 'Implemented',
  WontFix: 'Won’t Fix',
  Duplicate: 'Duplicate',
  CannotReproduce: 'Cannot Reproduce',
  ByDesign: 'By Design',
}

export const priorityLabel = (p: Priority) => priorities.find((o) => o.value === p)?.label ?? p
export const resolutionLabel = (r: Resolution) => resolutionLabels[r] ?? r

/** Status ids, matching src/BugTracker.Domain/StatusIds.cs. */
export const StatusIds = {
  New: 1,
  Triaged: 2,
  Assigned: 3,
  InProgress: 4,
  ReadyForTest: 5,
  Verified: 6,
  Closed: 7,
  Reopened: 8,
  WontFix: 9,
} as const

/** "BT-1042", "bt1042" or "1042" → 1042; anything else → null. */
export function parseTicketNumber(text: string): number | null {
  const match = /^(?:BT-?)?(\d{1,9})$/i.exec(text.trim())
  return match ? Number(match[1]) : null
}
