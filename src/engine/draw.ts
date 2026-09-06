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

/**
 * Rank order, strongest first — the spine of a banded draw.
 *
 * Shuffled before it is sorted, not after: `sort` is stable, so equal ranks would
 * otherwise keep the order they arrived in, which is the roster's Hebrew alphabet.
 * Shuffling first hands the seed exactly the decisions rank does not make — ties, and
 * the unranked, who are all tied with each other — and nothing else.
 */
export function rankedOrder(
  playerIds: readonly PlayerId[],
  ranks: Readonly<Record<PlayerId, number>>,
  rng: Rng,
): PlayerId[] {
  return shuffle(playerIds, rng).sort((a, b) => {
    const ra = ranks[a]
    const rb = ranks[b]
    // Not `(ranks[a] ?? -Infinity) - ...`: two unranked players would subtract
    // -Infinity from -Infinity and compare NaN, which sorts unpredictably.
    if (ra === undefined) return rb === undefined ? 0 : 1
    if (rb === undefined) return -1
    return rb - ra
  })
}

/**
 * Arrange a rank order so that `snakeIntoGroups` deals each band into one group.
 *
 * The snake exists to *spread* consecutive draw positions across groups, which is the
 * right default for an unseeded draw and the exact opposite of what banding wants.
 * Rather than give the group builder a second mode, this inverts the snake: it works
 * out which positions each group will be handed and drops a whole band on them. Group
 * A comes out as the strongest players, group B the next, and every match inside a
 * group is between near neighbours.
 */
export function bandedGroupOrder(sorted: readonly PlayerId[], groupCount: number): PlayerId[] {
  const positionsOf: number[][] = Array.from({ length: groupCount }, () => [])
  for (let position = 0; position < sorted.length; position++) {
    const row = Math.floor(position / groupCount)
    const col = position % groupCount
    positionsOf[row % 2 === 0 ? col : groupCount - 1 - col].push(position)
  }

  const out = new Array<PlayerId>(sorted.length)
  let next = 0
  for (const positions of positionsOf) {
    for (const position of positions) out[position] = sorted[next++]
  }
  return out
}

/**
 * Arrange a rank order so that `seedBracketSlots` pairs rank neighbours in round one.
 *
 * Standard seeding pairs seed s with seed size+1-s — best against worst — and hands
 * the byes to the lowest seed *numbers*, which are the top of the draw. Banding keeps
 * the second half of that (the strongest still get the byes; a bye is worth most to
 * the player most likely to use it) and inverts the first: each pair of bracket seats
 * is filled with two consecutive names off the rank list instead of one from each end.
 *
 * Written as a closed form over the seed pairs rather than by permuting the finished
 * bracket, so `seedBracketSlots` and `bracketSeedOrder` stay exactly as they are.
 */
export function bandedBracketOrder(sorted: readonly PlayerId[]): PlayerId[] {
  if (sorted.length === 0) return []
  const size = nextPowerOfTwo(Math.max(sorted.length, 2))
  const byes = size - sorted.length

  const out = new Array<PlayerId>(sorted.length)
  // Seeds 1..byes are the ones standard seeding leaves unopposed, so they take the
  // top of the rank list one for one.
  for (let seed = 1; seed <= byes; seed++) out[seed - 1] = sorted[seed - 1]

  let next = byes
  for (let seed = byes + 1; seed <= size / 2; seed++) {
    out[seed - 1] = sorted[next]
    out[size - seed] = sorted[next + 1]
    next += 2
  }
  return out
}
