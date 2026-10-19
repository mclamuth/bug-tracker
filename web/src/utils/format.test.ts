import { describe, expect, it } from 'vitest'
import { parseTicketNumber } from '../tickets/labels'
import { activityTime, calendarDate, fileKind, fileSize, relativeTime } from './format'

// Local times, so the tests behave the same in any time zone.
const now = new Date(2026, 9, 19, 15, 0) // Monday, October 19, 2026, 3:00 PM
const at = (y: number, m: number, d: number, h: number, min: number, s = 0) =>
  new Date(y, m, d, h, min, s).toISOString()

describe('relativeTime', () => {
  it.each([
    [at(2026, 9, 19, 14, 59, 30), 'Just now'],
    [at(2026, 9, 19, 14, 48), '12 min ago'],
    [at(2026, 9, 19, 11, 30), '3 hr ago'],
    [at(2026, 9, 18, 23, 30), 'Yesterday'],
    [at(2026, 9, 15, 9, 0), '4 days ago'],
    [at(2026, 9, 3, 9, 0), 'Oct 3'],
    [at(2025, 11, 30, 9, 0), 'Dec 30, 2025'],
  ])('%s → %s', (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected)
  })
})

describe('activityTime', () => {
  it.each([
    [at(2026, 9, 19, 14, 48), '12 min ago'],
    [at(2026, 9, 18, 15, 45), 'Yesterday at 3:45 PM'],
    [at(2026, 9, 13, 10, 18), 'Tuesday at 10:18 AM'],
    [at(2026, 9, 3, 9, 14), 'October 3, 2026 at 9:14 AM'],
  ])('%s → %s', (iso, expected) => {
    expect(activityTime(iso, now)).toBe(expected)
  })
})

describe('formatting', () => {
  it('shows date-only values without shifting the day', () => {
    expect(calendarDate('2026-11-06')).toBe('November 6, 2026')
  })

  it('shows file sizes and kinds', () => {
    expect(fileSize(284 * 1024)).toBe('284 KB')
    expect(fileSize(1.2 * 1024 * 1024)).toBe('1.2 MB')
    expect(fileKind('mileage-total.png')).toBe('PNG')
  })

  it('reads ticket numbers the way the API does', () => {
    expect(parseTicketNumber('BT-1042')).toBe(1042)
    expect(parseTicketNumber(' bt1042 ')).toBe(1042)
    expect(parseTicketNumber('1042')).toBe(1042)
    expect(parseTicketNumber('mileage')).toBeNull()
  })
})
