import { describe, expect, it } from 'vitest'
import {
  bandedBracketOrder,
  bandedGroupOrder,
  nextPowerOfTwo,
  rankedOrder,
  seedBracketSlots,
  snakeIntoGroups,
} from '../draw'
import { rngFromSeed } from '../rng'
import { buildFixtures, levelDrawOrder } from '../resolve'
import type { FormatConfig, Level, PlayerId } from '../types'

const players = (n: number): PlayerId[] => Array.from({ length: n }, (_, i) => `p${i + 1}`)

/** p1 is the strongest, and every one after it is 50 points weaker. */
function ladder(n: number): Record<PlayerId, number> {
  return Object.fromEntries(players(n).map((id, i) => [id, 2000 - i * 50]))
}

function makeLevel(
  config: FormatConfig,
  playerCount: number,
  ranks?: Record<PlayerId, number>,
  seed = 'SEED1234',
): Level {
  return {
    id: 'L1',
    name: 'A',
    playerIds: players(playerCount),
    config,
    bestOf: 5,
    seed,
    withdrawn: [],
    ranks,
  }
}

const sortedCopy = (ids: readonly PlayerId[]): PlayerId[] => [...ids].sort()

describe('rankedOrder', () => {
  it('puts the strongest first', () => {
    expect(rankedOrder(players(6), ladder(6), rngFromSeed('X'))).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
    ])
  })

  it('leaves the unranked at the back, whatever the seed', () => {
    const ranks = { p2: 1500, p5: 900 }
    for (const seed of ['A', 'B', 'C', 'D']) {
      const order = rankedOrder(players(5), ranks, rngFromSeed(seed))
      expect(order.slice(0, 2)).toEqual(['p2', 'p5'])
      expect(sortedCopy(order.slice(2))).toEqual(['p1', 'p3', 'p4'])
    }
  })

  it('lets the seed decide between players level on points', () => {
    // Everyone on the same rank, so rank decides nothing and the seed decides all of
    // it: two seeds have to be able to disagree.
    const level = Object.fromEntries(players(8).map((id) => [id, 1000]))
    const a = rankedOrder(players(8), level, rngFromSeed('AAAA1111'))
    const b = rankedOrder(players(8), level, rngFromSeed('BBBB2222'))
    expect(a).not.toEqual(b)
    expect(sortedCopy(a)).toEqual(sortedCopy(b))
  })

  it('is a permutation, never a loss', () => {
    const order = rankedOrder(players(9), { p4: 1200, p9: 1200, p1: 800 }, rngFromSeed('S'))
    expect(sortedCopy(order)).toEqual(sortedCopy(players(9)))
  })
})

describe('bandedGroupOrder', () => {
  it('hands each group one contiguous band of the rank list', () => {
    for (const [count, groupCount] of [
      [8, 2],
      [12, 3],
      [9, 3],
      [10, 3],
      [7, 2],
      [6, 1],
      [13, 4],
    ]) {
      const sorted = players(count)
      const groups = snakeIntoGroups(bandedGroupOrder(sorted, groupCount), groupCount)

      let next = 0
      for (const group of groups) {
        const band = sorted.slice(next, next + group.length)
        expect(sortedCopy(group), `${count} players in ${groupCount} groups`).toEqual(
          sortedCopy(band),
        )
        next += group.length
      }
      expect(next).toBe(count)
    }
  })

  it('keeps every player exactly once', () => {
    expect(sortedCopy(bandedGroupOrder(players(11), 3))).toEqual(sortedCopy(players(11)))
  })
})

describe('bandedBracketOrder', () => {
  /** The first-round pairings a bracket order produces, written as rank places. */
  function firstRound(sorted: readonly PlayerId[]): (number | 'bye')[][] {
    const slots = seedBracketSlots(bandedBracketOrder(sorted))
    const pairs: (number | 'bye')[][] = []
    for (let i = 0; i < slots.length; i += 2) {
      pairs.push(
        [slots[i], slots[i + 1]].map((slot) =>
          slot.kind === 'player' ? sorted.indexOf(slot.playerId) : ('bye' as const),
        ),
      )
    }
    return pairs
  }

  it('pairs rank neighbours when the field fills the bracket', () => {
    expect(firstRound(players(8))).toEqual([
      [0, 1],
      [6, 7],
      [2, 3],
      [4, 5],
    ])
  })

  it('gives the byes to the strongest, and pairs the rest off in order', () => {
    const pairs = firstRound(players(6))
    const gotByes = pairs
      .filter((pair) => pair.includes('bye'))
      .flatMap((pair) => pair.filter((seat) => seat !== 'bye'))
    expect(sortedCopy(gotByes.map(String))).toEqual(['0', '1'])
  })

  it('never seats two players more than one rank apart in round one', () => {
    for (let count = 2; count <= 33; count++) {
      for (const pair of firstRound(players(count))) {
        if (pair.includes('bye')) continue
        const [a, b] = pair as number[]
        expect(Math.abs(a - b), `${count} players`).toBe(1)
      }
    }
  })

  it('produces exactly one seat per player, and byes for the remainder', () => {
    for (let count = 1; count <= 33; count++) {
      const order = bandedBracketOrder(players(count))
      expect(sortedCopy(order), `${count} players`).toEqual(sortedCopy(players(count)))
      const slots = seedBracketSlots(order)
      expect(slots.length).toBe(nextPowerOfTwo(Math.max(count, 2)))
      expect(slots.filter((slot) => slot.kind === 'player').length).toBe(count)
    }
  })
})

describe('a level drawn against ranks', () => {
  it('is unchanged when nobody in it is ranked', () => {
    const level = makeLevel({ format: 'groupsKnockout', groupCount: 2, advancePerGroup: 2 }, 8)
    expect(levelDrawOrder({ ...level, ranks: {} })).toEqual(levelDrawOrder(level))
    expect(levelDrawOrder({ ...level, ranks: { stranger: 1500 } })).toEqual(levelDrawOrder(level))
  })

  it('puts the top band in the first group', () => {
    const level = makeLevel(
      { format: 'groupsKnockout', groupCount: 2, advancePerGroup: 2 },
      8,
      ladder(8),
    )
    const { groups } = buildFixtures(level)
    expect(sortedCopy(groups[0].playerIds)).toEqual(['p1', 'p2', 'p3', 'p4'])
    expect(sortedCopy(groups[1].playerIds)).toEqual(['p5', 'p6', 'p7', 'p8'])
  })

  it('lists a round robin strongest first', () => {
    expect(levelDrawOrder(makeLevel({ format: 'roundRobin' }, 5, ladder(5)))).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
    ])
  })

  it('is reproducible', () => {
    const level = makeLevel({ format: 'singleElim' }, 12, ladder(12))
    expect(buildFixtures(level).matches.map((m) => m.id)).toEqual(
      buildFixtures(level).matches.map((m) => m.id),
    )
    expect(levelDrawOrder(level)).toEqual(levelDrawOrder(level))
  })

  it('still lets a hand-made arrangement win', () => {
    const level = makeLevel({ format: 'roundRobin' }, 4, ladder(4))
    const manual = ['p3', 'p1', 'p4', 'p2']
    expect(levelDrawOrder({ ...level, manualOrder: manual })).toEqual(manual)
  })

  it('draws the unranked in among the ranked rather than dropping them', () => {
    const level = makeLevel({ format: 'roundRobin' }, 6, { p2: 1400, p5: 1100 })
    const order = levelDrawOrder(level)
    expect(order.slice(0, 2)).toEqual(['p2', 'p5'])
    expect(sortedCopy(order)).toEqual(sortedCopy(players(6)))
  })
})
