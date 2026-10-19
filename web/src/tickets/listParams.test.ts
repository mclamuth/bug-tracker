import { describe, expect, it } from 'vitest'
import { describeSort, hasFilters, nextSort, readListParams, writeListParams } from './listParams'

const read = (query: string) => readListParams(new URLSearchParams(query))

describe('ticket list URL', () => {
  it('defaults to open tickets, last updated first, page 1', () => {
    expect(read('')).toEqual({
      view: 'open',
      type: undefined,
      statusId: undefined,
      applicationId: undefined,
      assigneeId: undefined,
      severity: undefined,
      priority: undefined,
      search: undefined,
      sort: 'updated',
      direction: 'desc',
      page: 1,
      pageSize: 25,
    })
    expect(writeListParams(read('')).toString()).toBe('')
  })

  it('round-trips filters, sort and page', () => {
    const query =
      'view=all&type=Defect&statusId=4&applicationId=19&assigneeId=1&severity=High&priority=P2High&search=mileage&sort=title&direction=asc&page=3'
    expect(writeListParams(read(query)).toString()).toBe(query)
  })

  it('ignores values it does not recognise', () => {
    const params = read('view=mine&severity=Huge&statusId=-2&page=abc&sort=colour')
    expect(params.view).toBe('open')
    expect(params.severity).toBeUndefined()
    expect(params.statusId).toBeUndefined()
    expect(params.page).toBe(1)
    expect(params.sort).toBe('updated')
  })

  it('flips direction on the same column and starts a new column at its natural order', () => {
    const params = read('sort=title&direction=asc')
    expect(nextSort(params, 'title')).toEqual({ sort: 'title', direction: 'desc' })
    expect(nextSort(params, 'updated')).toEqual({ sort: 'updated', direction: 'desc' })
    expect(nextSort(params, 'severity')).toEqual({ sort: 'severity', direction: 'asc' })
  })

  it('describes the sort in words', () => {
    expect(describeSort('updated', 'desc')).toBe('Last updated (newest first)')
    expect(describeSort('title', 'asc')).toBe('Title (A–Z)')
    expect(describeSort('severity', 'asc')).toBe('Severity (highest first)')
  })

  it('knows when filters are set', () => {
    expect(hasFilters(read('view=closed'))).toBe(false)
    expect(hasFilters(read('search=BT-1042'))).toBe(true)
  })
})
