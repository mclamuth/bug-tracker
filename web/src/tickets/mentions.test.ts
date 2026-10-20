import { describe, expect, it } from 'vitest'
import { findMentionQuery, insertMention, matchPeople } from './mentions'

const people = ['Max Caber', 'Bobby McDonald', 'Hue Chi', 'Michael Lamuth', 'Elyse Orris', 'Ken Fukumoto'].map(
  (displayName) => ({ displayName }),
)

describe('findMentionQuery', () => {
  it.each([
    ['@', 1, { start: 0, query: '' }],
    ['Thanks @Ely', 11, { start: 7, query: 'Ely' }],
    ['Thanks @Elyse Or', 16, { start: 7, query: 'Elyse Or' }],
    ['cc\n@ma', 6, { start: 3, query: 'ma' }],
  ])('%j at %i', (text, caret, expected) => {
    expect(findMentionQuery(text, caret)).toEqual(expected)
  })

  it.each([
    ['email me at max@cta.org', 23],
    ['@ max', 5],
    ['no mention here', 15],
    ['@Max\nnext line', 14],
  ])('%j is not a mention', (text, caret) => {
    expect(findMentionQuery(text, caret)).toBeNull()
  })
})

describe('matchPeople', () => {
  it('matches the start of any name, first names first', () => {
    expect(matchPeople(people, 'm').map((p) => p.displayName)).toEqual([
      'Max Caber',
      'Michael Lamuth',
      'Bobby McDonald',
    ])
    expect(matchPeople(people, 'orr').map((p) => p.displayName)).toEqual(['Elyse Orris'])
    expect(matchPeople(people, 'zz')).toEqual([])
  })

  it('offers everyone (up to the limit) for a bare @', () => {
    expect(matchPeople(people, '', 3)).toHaveLength(3)
  })
})

describe('insertMention', () => {
  it('replaces what was typed with the full name and a space, keeping the rest', () => {
    const text = 'Thanks @Ely for testing'
    const result = insertMention(text, { start: 7, query: 'Ely' }, 11, 'Elyse Orris')
    expect(result).toEqual({ text: 'Thanks @Elyse Orris for testing', caret: 20 })
  })
})
