// Dates come from the API in UTC (ISO 8601) and are shown in the viewer's local time.

const MINUTE = 60_000
const HOUR = 60 * MINUTE

const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
const longDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const shortDateYear = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' })

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Whole calendar days between two moments, in local time (0 = same day). */
function daysBetween(earlier: Date, later: Date): number {
  return Math.round((startOfDay(later) - startOfDay(earlier)) / (24 * HOUR))
}

/** For lists: "Just now", "5 min ago", "3 hr ago", "Yesterday", "4 days ago", then "Oct 3" (or "Oct 3, 2025"). */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const ago = now.getTime() - then.getTime()
  if (ago < MINUTE) return 'Just now'
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)} min ago`
  const days = daysBetween(then, now)
  if (days === 0) return `${Math.floor(ago / HOUR)} hr ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return (then.getFullYear() === now.getFullYear() ? shortDate : shortDateYear).format(then)
}

/** For the activity feed: "Just now", "12 min ago", "3 hr ago", "Yesterday at 3:45 PM", "Monday at 10:18 AM", "October 3, 2026 at 9:14 AM". */
export function activityTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const ago = now.getTime() - then.getTime()
  if (ago < MINUTE) return 'Just now'
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)} min ago`
  const days = daysBetween(then, now)
  if (days === 0) return `${Math.floor(ago / HOUR)} hr ago`
  if (days === 1) return `Yesterday at ${time.format(then)}`
  if (days < 7) return `${weekday.format(then)} at ${time.format(then)}`
  return dateTime(iso)
}

/** "October 12, 2026 at 9:14 AM" */
export function dateTime(iso: string): string {
  const d = new Date(iso)
  return `${longDate.format(d)} at ${time.format(d)}`
}

/** A date-only value ("2026-11-06") as "November 6, 2026", with no time-zone shift. */
export function calendarDate(value: string): string {
  const [y = 1970, m = 1, d = 1] = value.split('-').map(Number)
  return longDate.format(new Date(y, m - 1, d))
}

/** "284 KB", "1.2 MB" */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** "PDF", "PNG" — the file extension, for file-type badges. */
export function fileKind(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot + 1).toUpperCase() : 'FILE'
}
