import { describe, expect, it } from 'vitest'
import { isImplemented, minimumPlayers, suggestedConfig } from '../advisor'
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
