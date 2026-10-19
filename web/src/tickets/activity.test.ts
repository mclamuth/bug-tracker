import { describe, expect, it } from 'vitest'
import type { CommentDto, HistoryEntryDto } from '../api/types'
import { buildActivity, describeChange, splitMentions } from './activity'

const person = (id: number, displayName: string) => ({ id, displayName, initials: '' })
const max = person(1, 'Max Caber')
const elyse = person(6, 'Elyse Orris')

const change = (fieldName: string, oldValue: string | null, newValue: string | null) =>
  describeChange({ fieldName, oldValue, newValue })

describe('describeChange', () => {
  it.each([
    [change('Created', null, 'New'), 'created this ticket'],
    [change('Status', 'New', 'Assigned'), 'changed Status from New to Assigned'],
    [change('Severity', 'Medium', 'High'), 'changed Severity from Medium to High'],
    [change('Due date', null, 'November 6, 2026'), 'set Due date to November 6, 2026'],
    [change('Resolution', 'Fixed', null), 'cleared Resolution'],
    [change('Title', 'Old', 'New'), 'changed Title from “Old” to “New”'],
    [change('Description', 'a', 'b'), 'updated the description'],
    [change('Assignee', null, 'Max Caber'), 'assigned the ticket to Max Caber'],
    [change('Assignee', 'Max Caber', 'Hue Chi'), 'reassigned the ticket from Max Caber to Hue Chi'],
    [change('Assignee', 'Max Caber', null), 'unassigned Max Caber'],
    [change('Attachment', null, 'report.pdf'), 'attached report.pdf'],
    [change('Attachment', 'report.pdf', null), 'removed the attachment report.pdf'],
  ])('%s', (actual, expected) => {
    expect(actual).toBe(expected)
  })
})

describe('buildActivity', () => {
  it('merges comments and history newest first, changes before a comment made at the same moment', () => {
    const comment: CommentDto = {
      id: 7,
      author: max,
      body: 'Fixed the calculation.',
      mentions: [],
      createdAt: '2026-10-19T20:00:00.5Z',
      editedAt: null,
    }
    const history: HistoryEntryDto[] = [
      {
        id: 1,
        changedBy: max,
        changedAt: '2026-10-19T19:59:59.9512345Z',
        fieldName: 'Created',
        oldValue: null,
        newValue: 'New',
      },
      {
        id: 2,
        changedBy: max,
        changedAt: '2026-10-19T20:00:00.5Z',
        fieldName: 'Status',
        oldValue: 'In Progress',
        newValue: 'Ready for Test',
      },
    ]

    expect(buildActivity([comment], history).map((i) => i.id)).toEqual(['h2', 'c7', 'h1'])
  })
})

describe('splitMentions', () => {
  it('marks the mentions the server recognised, and nothing else', () => {
    expect(splitMentions('@Elyse Orris ready to retest, thanks @Max Caber. cc @Nobody', [elyse, max])).toEqual([
      { text: '@Elyse Orris', mention: true },
      { text: ' ready to retest, thanks ', mention: false },
      { text: '@Max Caber', mention: true },
      { text: '. cc @Nobody', mention: false },
    ])
  })

  it('leaves text alone when nobody was mentioned', () => {
    expect(splitMentions('No mentions here', [])).toEqual([{ text: 'No mentions here', mention: false }])
  })
})
