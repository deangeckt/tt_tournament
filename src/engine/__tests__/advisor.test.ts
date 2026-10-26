import { describe, expect, it } from 'vitest'
import {
  consolationConfig,
  defaultConfig,
  isImplemented,
  minimumPlayers,
  redrawnConfig,
  suggestedConfig,
} from '../advisor'
import { buildFixtures } from '../resolve'
import type { FormatName, Level } from '../types'

const FORMATS: FormatName[] = ['roundRobin', 'singleElim', 'groupsKnockout', 'doubleElim']

function levelOf(format: FormatName, playerCount: number): Level {
  return {
    id: 'L1',
    name: 'A',
    playerIds: Array.from({ length: playerCount }, (_, i) => `p${i}`),
    config: format === 'groupsKnockout' ? { format, groupCount: 2, advancePerGroup: 2 } : { format },
    bestOf: 5,
    seed: 'seed',
    withdrawn: [],
  }
}

describe('isImplemented', () => {
  it('names double elimination, and nothing else, as unbuilt', () => {
    for (const format of FORMATS) {
      expect(isImplemented(format)).toBe(format !== 'doubleElim')
    }
  })

  /*
   * The predicate is only worth having while it agrees with the fixtures. A format it
   * calls built has to produce its own shape; double elimination falls back to the
   * winners bracket alone, which is why the picker refuses to quote its match count.
   */
  it('agrees with what the fixtures actually generate', () => {
    const single = buildFixtures(levelOf('singleElim', 8)).matches.length
    const double = buildFixtures(levelOf('doubleElim', 8)).matches.length
    expect(double).toBe(single)
    expect(double).not.toBe(8 * 2 - 2)
  })

  it('never recommends a format it cannot build', () => {
    for (let playerCount = 2; playerCount <= 40; playerCount++) {
      expect(isImplemented(suggestedConfig(playerCount).format)).toBe(true)
    }
  })

  it('still reports a minimum field for the unbuilt format, so the card can be read', () => {
    expect(minimumPlayers('doubleElim')).toBeGreaterThan(0)
  })
})

/*
 * `separateGroups` is how a level says its knockout keeps groupmates apart, and its
 * absence is how a level drawn before keeps the bracket it was played on. So it has to
 * be on everything drawn now, and on nothing that has not been drawn again.
 */
describe('separateGroups', () => {
  const legacy = { format: 'groupsKnockout', groupCount: 4, advancePerGroup: 2 } as const

  it('is on every groups-then-knockout level drawn now', () => {
    expect(defaultConfig('groupsKnockout', 16)).toMatchObject({ separateGroups: true })
    expect(suggestedConfig(16)).toMatchObject({ separateGroups: true })
  })

  it('reaches an old level by drawing again, and touches no other format', () => {
    expect(redrawnConfig(legacy)).toEqual({ ...legacy, separateGroups: true })
    expect(redrawnConfig({ format: 'singleElim', consolation: true })).toEqual({
      format: 'singleElim',
      consolation: true,
    })
  })

  it('carries into the consolation exactly when the main draw has it', () => {
    expect(consolationConfig({ ...legacy, separateGroups: true }, 12)).toMatchObject({
      format: 'groupsKnockout',
      separateGroups: true,
    })
    expect(consolationConfig(legacy, 12)).not.toHaveProperty('separateGroups')
  })
})
