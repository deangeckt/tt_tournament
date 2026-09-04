import { describe, expect, it } from 'vitest'
import { buildFixtures, drawPlacements, levelDrawOrder } from '../resolve'
import type { FormatConfig, Level, PlayerId } from '../types'

const players = (n: number): PlayerId[] => Array.from({ length: n }, (_, i) => `p${i + 1}`)

function makeLevel(config: FormatConfig, playerCount: number, seed = 'SEED1234'): Level {
  return {
    id: 'L1',
    name: 'A',
    playerIds: players(playerCount),
    config,
    bestOf: 5,
    seed,
    withdrawn: [],
  }
}

describe('manual draw order', () => {
  it('falls back to the seeded shuffle when there is none', () => {
    const level = makeLevel({ format: 'roundRobin' }, 8)
    expect(levelDrawOrder(level)).toEqual(levelDrawOrder({ ...level, manualOrder: undefined }))
  })

  it('an empty arrangement is not an arrangement', () => {
    const level = makeLevel({ format: 'roundRobin' }, 8)
    expect(levelDrawOrder({ ...level, manualOrder: [] })).toEqual(levelDrawOrder(level))
  })

  it('is used verbatim when it covers the level', () => {
    const level = makeLevel({ format: 'groupsKnockout', groupCount: 2, advancePerGroup: 2 }, 8)
    const manual = players(8).reverse()
    expect(levelDrawOrder({ ...level, manualOrder: manual })).toEqual(manual)
  })

  it('drops players who have left the level', () => {
    const level = makeLevel({ format: 'roundRobin' }, 4)
    const order = levelDrawOrder({ ...level, manualOrder: ['p3', 'ghost', 'p1', 'p2', 'p4'] })
    expect(order).toEqual(['p3', 'p1', 'p2', 'p4'])
  })

  it('seats a late entrant instead of discarding the arrangement', () => {
    const level = makeLevel({ format: 'roundRobin' }, 5)
    // Arranged when only four players had arrived; p5 signed up afterwards.
    const order = levelDrawOrder({ ...level, manualOrder: ['p4', 'p3', 'p2', 'p1'] })
    expect(order.slice(0, 4)).toEqual(['p4', 'p3', 'p2', 'p1'])
    expect(order).toHaveLength(5)
    expect(order).toContain('p5')
  })

  it('moves a player into another group without touching match ids', () => {
    const level = makeLevel({ format: 'groupsKnockout', groupCount: 2, advancePerGroup: 2 }, 8)
    const drawn = levelDrawOrder(level)
    const swapped = drawn.slice()
    ;[swapped[0], swapped[1]] = [swapped[1], swapped[0]]

    const before = buildFixtures(level)
    const after = buildFixtures({ ...level, manualOrder: swapped })

    // Results are keyed by match id, so the ids must survive a rearrangement even
    // though who plays whom does not.
    expect(after.matches.map((m) => m.id)).toEqual(before.matches.map((m) => m.id))
    expect(after.groups.flatMap((g) => g.playerIds)).not.toEqual(
      before.groups.flatMap((g) => g.playerIds),
    )
  })

  it('keeps every player exactly once after a swap', () => {
    const level = makeLevel({ format: 'groupsKnockout', groupCount: 3, advancePerGroup: 2 }, 11)
    const order = levelDrawOrder(level)
    ;[order[0], order[7]] = [order[7], order[0]]
    const groups = buildFixtures({ ...level, manualOrder: order }).groups
    expect(groups.flatMap((g) => g.playerIds).sort()).toEqual(players(11).sort())
  })
})

describe('draw placements', () => {
  it('reports a group for every player in a group stage', () => {
    const level = makeLevel({ format: 'groupsKnockout', groupCount: 2, advancePerGroup: 2 }, 8)
    const placements = drawPlacements(level)
    expect(placements).toHaveLength(8)
    expect(placements.every((p) => p.groupId)).toBe(true)
    expect(new Set(placements.map((p) => p.groupId)).size).toBe(2)
  })

  it('reports an opening bracket match in a knockout', () => {
    const level = makeLevel({ format: 'singleElim' }, 8)
    const placements = drawPlacements(level)
    expect(placements.every((p) => p.matchId)).toBe(true)
    expect(new Set(placements.map((p) => p.matchId)).size).toBe(4)
  })

  it('leaves a player with a bye unpaired in the first round', () => {
    // Six players in an eight-slot bracket: two of them walk into round two.
    const level = makeLevel({ format: 'singleElim' }, 6)
    const placements = drawPlacements(level)
    expect(placements).toHaveLength(6)
    expect(placements.filter((p) => p.matchId)).toHaveLength(6)
  })

  it('lists players in draw order', () => {
    const level = makeLevel({ format: 'roundRobin' }, 6)
    expect(drawPlacements(level).map((p) => p.playerId)).toEqual(levelDrawOrder(level))
    expect(drawPlacements(level).map((p) => p.position)).toEqual([0, 1, 2, 3, 4, 5])
  })
})
