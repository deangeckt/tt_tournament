import { describe, expect, it } from 'vitest'
import { generateSeed, hashSeed, mulberry32, rngFromSeed, shuffle } from '../rng'
import { bracketSeedOrder, nextPowerOfTwo, seedBracketSlots, snakeIntoGroups } from '../draw'
import { generateGroupMatches, roundRobinRounds, singleGroup } from '../formats/roundRobin'
import { generateSingleElim } from '../formats/singleElim'
import type { PlayerId } from '../types'

const players = (n: number): PlayerId[] => Array.from({ length: n }, (_, i) => `p${i + 1}`)

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = Array.from({ length: 20 }, rngFromSeed('ABC123'))
    const b = Array.from({ length: 20 }, rngFromSeed('ABC123'))
    expect(a).toEqual(b)
  })

  it('differs across seeds', () => {
    const a = shuffle(players(24), rngFromSeed('SEED-ONE'))
    const b = shuffle(players(24), rngFromSeed('SEED-TWO'))
    expect(a).not.toEqual(b)
  })

  it('shuffle is a permutation and does not mutate its input', () => {
    const input = players(13)
    const snapshot = input.slice()
    const out = shuffle(input, rngFromSeed('X'))
    expect(input).toEqual(snapshot)
    expect(out.slice().sort()).toEqual(input.slice().sort())
  })

  it('produces uniform-ish output', () => {
    const rng = mulberry32(hashSeed('uniformity'))
    const buckets = new Array(10).fill(0)
    for (let i = 0; i < 100_000; i++) buckets[Math.floor(rng() * 10)]++
    for (const count of buckets) expect(count).toBeGreaterThan(9000)
  })

  it('generates readable seeds without ambiguous characters', () => {
    const seed = generateSeed(rngFromSeed('meta'))
    expect(seed).toHaveLength(8)
    expect(seed).not.toMatch(/[01IO]/)
  })
})

describe('bracket seeding', () => {
  it('produces the standard recursive order', () => {
    expect(bracketSeedOrder(2)).toEqual([1, 2])
    expect(bracketSeedOrder(4)).toEqual([1, 4, 2, 3])
    expect(bracketSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
  })

  it('pairs seeds so every first-round match sums to size + 1', () => {
    for (const size of [4, 8, 16, 32]) {
      const order = bracketSeedOrder(size)
      expect(new Set(order).size).toBe(size)
      for (let i = 0; i < order.length; i += 2) {
        expect(order[i] + order[i + 1]).toBe(size + 1)
      }
    }
  })

  it('keeps the top two seeds apart until the final', () => {
    const order = bracketSeedOrder(16)
    const half = order.slice(0, 8)
    expect(half).toContain(1)
    expect(half).not.toContain(2)
  })

  it('rounds up to a power of two', () => {
    expect(nextPowerOfTwo(12)).toBe(16)
    expect(nextPowerOfTwo(16)).toBe(16)
    expect(nextPowerOfTwo(13)).toBe(16)
  })

  it('distributes byes rather than clustering them', () => {
    const slots = seedBracketSlots(players(12))
    expect(slots).toHaveLength(16)
    expect(slots.filter((s) => s.kind === 'bye')).toHaveLength(4)

    // No first-round match may be bye vs bye — that would be a phantom match.
    for (let i = 0; i < slots.length; i += 2) {
      expect(slots[i].kind === 'bye' && slots[i + 1].kind === 'bye').toBe(false)
    }
    // Byes spread across both halves of the draw rather than stacking in one.
    const firstHalf = slots.slice(0, 8).filter((s) => s.kind === 'bye').length
    expect(firstHalf).toBe(2)
  })

  it('gives an exact power-of-two field no byes', () => {
    expect(seedBracketSlots(players(8)).every((s) => s.kind === 'player')).toBe(true)
  })
})

describe('snake seeding', () => {
  it('balances group sizes for 24 players in 6 groups', () => {
    const groups = snakeIntoGroups(players(24), 6)
    expect(groups.map((g) => g.length)).toEqual([4, 4, 4, 4, 4, 4])
  })

  it('keeps uneven fields within one player of each other', () => {
    for (const [count, groupCount] of [[13, 4], [7, 3], [22, 6], [10, 3]] as const) {
      const sizes = snakeIntoGroups(players(count), groupCount).map((g) => g.length)
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(count)
    }
  })

  it('serpentines rather than repeating the same direction', () => {
    const groups = snakeIntoGroups(['a', 'b', 'c', 'd', 'e', 'f'], 3)
    expect(groups).toEqual([['a', 'f'], ['b', 'e'], ['c', 'd']])
  })
})

describe('round robin', () => {
  it('pairs every player exactly once', () => {
    for (const count of [4, 5, 6, 7, 8]) {
      const rounds = roundRobinRounds(players(count))
      const pairs = rounds.flat().map(([a, b]) => [a, b].sort().join('|'))
      expect(new Set(pairs).size).toBe((count * (count - 1)) / 2)
      expect(pairs).toHaveLength((count * (count - 1)) / 2)
    }
  })

  it('never schedules a player twice in one round', () => {
    for (const count of [5, 8, 11]) {
      for (const round of roundRobinRounds(players(count))) {
        const seen = round.flat()
        expect(new Set(seen).size).toBe(seen.length)
      }
    }
  })

  it('never emits the rest sentinel as a player', () => {
    const names = roundRobinRounds(players(7)).flat().flat()
    expect(names.every((n) => n.startsWith('p'))).toBe(true)
  })

  it('generates stable, unique match ids', () => {
    const group = singleGroup('L1', 'A', players(6))
    const ids = generateGroupMatches(group).map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(generateGroupMatches(group).map((m) => m.id)).toEqual(ids)
  })

  it('handles degenerate sizes', () => {
    expect(roundRobinRounds([])).toEqual([])
    expect(roundRobinRounds(['solo'])).toEqual([])
    expect(roundRobinRounds(['a', 'b']).flat()).toHaveLength(1)
  })
})

describe('single elimination', () => {
  it('builds a full tree with the right match count', () => {
    const matches = generateSingleElim('L1', seedBracketSlots(players(8)))
    expect(matches).toHaveLength(7)
    expect(matches.filter((m) => m.round === 0)).toHaveLength(4)
    expect(matches.filter((m) => m.round === 2)).toHaveLength(1)
  })

  it('wires later rounds to earlier matches', () => {
    const matches = generateSingleElim('L1', seedBracketSlots(players(4)))
    const final = matches.find((m) => m.round === 1)!
    expect(final.a).toEqual({ kind: 'winnerOf', matchId: matches[0].id })
    expect(final.b).toEqual({ kind: 'winnerOf', matchId: matches[1].id })
  })

  it('every referenced match exists', () => {
    const matches = generateSingleElim('L1', seedBracketSlots(players(12)))
    const ids = new Set(matches.map((m) => m.id))
    for (const m of matches) {
      for (const slot of [m.a, m.b]) {
        if (slot.kind === 'winnerOf') expect(ids.has(slot.matchId)).toBe(true)
      }
    }
  })
})
