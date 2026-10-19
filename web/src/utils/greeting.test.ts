import { describe, expect, it } from 'vitest'
import { greeting } from './greeting'

describe('greeting', () => {
  it.each([
    [8, 'Good morning'],
    [12, 'Good afternoon'],
    [16, 'Good afternoon'],
    [17, 'Good evening'],
  ])('at %i:00 says "%s"', (hour, expected) => {
    expect(greeting(new Date(2026, 9, 19, hour))).toBe(expected)
  })
})
