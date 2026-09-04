import type { PlayerId, Slot } from './types'
import { shuffle, type Rng } from './rng'

/**
 * Standard single-elimination seed order for a bracket of `size` slots.
 *
 * Built by repeatedly mirroring: [1] -> [1,2] -> [1,4,3,2] -> [1,8,5,4,3,6,7,2] ...
 * Reading it in pairs gives the first-round matches (1v8, 4v5, 3v6, 2v7), which is
 * the arrangement that keeps the top seeds apart for as long as possible.
 */
export function bracketSeedOrder(size: number): number[] {
  let order = [1]
  while (order.length < size) {
    const n = order.length * 2
    const next: number[] = []
    for (const x of order) {
      next.push(x)
      next.push(n + 1 - x)
    }
    order = next
  }
  return order
}

export function nextPowerOfTwo(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

/**
 * Place players into a padded bracket, filling the remainder with byes.
 *
 * Because byes take the highest seed *numbers* and the seed order pairs 1-with-last,
 * 2-with-second-last and so on, byes land on distinct top seeds rather than clustering
 * in one quarter of the draw. Returns one slot per bracket position, in match order.
 */
export function seedBracketSlots(orderedPlayers: readonly PlayerId[]): Slot[] {
  const size = nextPowerOfTwo(Math.max(orderedPlayers.length, 2))
  const order = bracketSeedOrder(size)
  return order.map((seedNumber) => {
    const player = orderedPlayers[seedNumber - 1]
    return player ? { kind: 'player' as const, playerId: player } : { kind: 'bye' as const }
  })
}

/**
 * Snake (serpentine) distribution into groups: 0,1,2 then 2,1,0 then 0,1,2 ...
 *
 * Keeps group sizes within one of each other and spreads consecutive draw positions
 * across different groups.
 */
export function snakeIntoGroups(orderedPlayers: readonly PlayerId[], groupCount: number): PlayerId[][] {
  const groups: PlayerId[][] = Array.from({ length: groupCount }, () => [])
  orderedPlayers.forEach((playerId, i) => {
    const row = Math.floor(i / groupCount)
    const col = i % groupCount
    const index = row % 2 === 0 ? col : groupCount - 1 - col
    groups[index].push(playerId)
  })
  return groups
}

/** The randomized draw order for a level. Everything downstream derives from this. */
export function drawOrder(playerIds: readonly PlayerId[], rng: Rng): PlayerId[] {
  return shuffle(playerIds, rng)
}
