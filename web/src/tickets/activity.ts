import type { CommentDto, HistoryEntryDto, PersonDto } from '../api/types'

export type ActivityItem =
  | { kind: 'comment'; id: string; at: string; person: PersonDto; comment: CommentDto }
  | { kind: 'history'; id: string; at: string; person: PersonDto; text: string }

/** Long text fields: the feed says they changed without repeating the text. */
const longText = ['Description', 'Steps to reproduce', 'Expected result', 'Actual result']

/** One history row in words, after the person's name: "changed Status from New to Assigned". */
export function describeChange(entry: Pick<HistoryEntryDto, 'fieldName' | 'oldValue' | 'newValue'>): string {
  const { fieldName: field, oldValue: from, newValue: to } = entry
  if (field === 'Created') return 'created this ticket'
  if (field === 'Attachment') return to ? `attached ${to}` : `removed the attachment ${from ?? ''}`.trim()
  if (longText.includes(field)) return `updated the ${field.toLowerCase()}`
  if (field === 'Assignee') {
    if (from && to) return `reassigned the ticket from ${from} to ${to}`
    if (to) return `assigned the ticket to ${to}`
    return `unassigned ${from ?? 'the ticket'}`
  }
  const quote = (v: string) => (field === 'Title' || field === 'Called in by' ? `“${v}”` : v)
  if (from && to) return `changed ${field} from ${quote(from)} to ${quote(to)}`
  if (to) return `set ${field} to ${quote(to)}`
  return `cleared ${field}`
}

/** Comments and history merged, newest first. */
export function buildActivity(comments: CommentDto[], history: HistoryEntryDto[]): ActivityItem[] {
  const items: ActivityItem[] = [
    ...comments.map((c) => ({
      kind: 'comment' as const,
      id: `c${c.id}`,
      at: c.createdAt,
      person: c.author,
      comment: c,
    })),
    ...history.map((h) => ({
      kind: 'history' as const,
      id: `h${h.id}`,
      at: h.changedAt,
      person: h.changedBy,
      text: describeChange(h),
    })),
  ]
  // Newest first; when a comment and a change share a moment (a status change with a note), the change goes first.
  return items.sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at) || (a.kind === b.kind ? 0 : a.kind === 'history' ? -1 : 1),
  )
}

/** Splits a comment into plain text and "@Full Name" mentions of the people the server recognised. */
export function splitMentions(body: string, people: PersonDto[]): { text: string; mention: boolean }[] {
  const names = people.map((p) => p.displayName).sort((a, b) => b.length - a.length)
  if (names.length === 0) return [{ text: body, mention: false }]
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(@(?:${escaped.join('|')}))(?![\\p{L}\\p{N}])`, 'giu')
  const parts: { text: string; mention: boolean }[] = []
  let last = 0
  for (const match of body.matchAll(pattern)) {
    if (match.index > last) parts.push({ text: body.slice(last, match.index), mention: false })
    parts.push({ text: match[0], mention: true })
    last = match.index + match[0].length
  }
  if (last < body.length) parts.push({ text: body.slice(last), mention: false })
  return parts
}
