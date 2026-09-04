import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import { roundLabel } from './labels'

/** Echoes the key, plus any interpolated values, so the test reads the choice made. */
const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${Object.values(options).join(',')}` : key) as unknown as TFunction

describe('round labels', () => {
  it('names the last round the final, whatever the bracket size', () => {
    expect(roundLabel(0, 0, t)).toBe('round.final')
    expect(roundLabel(4, 4, t)).toBe('round.final')
  })

  it('counts backwards from the final', () => {
    expect(roundLabel(2, 3, t)).toBe('round.semi')
    expect(roundLabel(1, 3, t)).toBe('round.quarter')
    expect(roundLabel(0, 3, t)).toBe('round.last16')
  })

  it('falls back to the field size for the early rounds of a big draw', () => {
    // Five rounds: 32 players, so the opening round is the round of 32.
    expect(roundLabel(0, 4, t)).toBe('round.of:32')
    expect(roundLabel(0, 5, t)).toBe('round.of:64')
  })
})
