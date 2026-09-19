import type { PlayerId } from './types'

/**
 * The order a group's matches are played in.
 *
 * Kept apart from the fixture generator because the two answer different questions,
 * and because only one of them may touch a match id. `formats/roundRobin.ts` decides
 * *which* matches exist and mints each id from where the draw put it; this file
 * decides only *when* each one is played. Keeping the running order out of the id is
 * what makes the whole feature safe to switch on, change or improve halfway through a
 * tournament — rearranging a night's matches moves not one stored result.
 *
 * Of the rules here only one is a regulation, and it is the one the module exists
 * for: ITTF 3.7.5.5 puts the match that decides qualification last, so that the final
 * pair on the table can never arrange a scoreline that suits them both. The rest —
 * nobody playing twice in a row, a batch of matches that can all start at once — is
 * about the night running well, and gives way to the regulation wherever they
 * disagree.
 *
 * It applies only to a group where every player carries a rank, because without one
 * the numbers are draw positions out of a shuffle: "the top two seeds play last" is a
 * statement about the field's strength, and calling a shuffled position seed 1 would
 * make it mean nothing.
 */

/**
 * A fixture named by the within-group seeds of its two players, 1 = strongest.
 *
 * Seeds rather than player ids on purpose. A running order is a property of the
 * seeding and not of whoever holds a seat, so it can be read against the regulations'
 * own wording and tested without a roster. It is also the shape a result-dependent
 * pairing would slot into — "seed 1 against the loser of the first match", which is
 * how the World Cup runs a group of three — without every caller having to change;
 * the `Slot` union already carries `winnerOf` and `loserOf` for that day.
 */
export type SeedPair = readonly [number, number]

export interface GroupSchedule {
  /**
   * The running order, in batches whose matches share no player, so everything in one
   * batch can go on a table at the same time. Flatten it for the order the matches
   * are actually played in.
   */
  rounds: SeedPair[][]
  /**
   * How often a player takes the table twice in a row. The quantity the plan is
   * chosen to minimise, and not always zero: three players force two of them, and
   * four players force two, whatever order the matches are put in.
   */
  backToBack: number
}

/**
 * Orders published by a federation or a league, keyed `players:advancing` — so
 * `"4:2"` is the order for a group of four from which the top two go through.
 *
 * A published table wins over anything generated here. None ships in this repo: the
 * tables circulating for groups of four and up could not be verified against the
 * current handbook, and a wrong "official" order is worse than an honest generated
 * one. A table that is verified drops in as config, and the generator goes back to
 * being the fallback it already is.
 */
export type PublishedOrders = Readonly<Record<string, readonly SeedPair[]>>

const INF = Number.POSITIVE_INFINITY

/**
 * The circle (Berger) method: pair everyone exactly once, arranged into rounds where
 * each player appears at most once. Returns seat indices into a field of `count`, so
 * that the fixture generator (which maps them to players) and the scheduler (which
 * maps them to seeds) work from one implementation rather than two that could drift.
 *
 * An odd field is given a ghost seat; pairings against it are the rest, and are
 * dropped rather than scheduled.
 */
export function circleRounds(count: number): Array<Array<[number, number]>> {
  const odd = count % 2 === 1
  const ghost = odd ? count : -1
  const n = odd ? count + 1 : count

  const rounds: Array<Array<[number, number]>> = []
  if (n < 2) return rounds

  const seats = Array.from({ length: n }, (_, i) => i)
  const rotating = seats.slice(1)
  for (let r = 0; r < n - 1; r++) {
    const round: Array<[number, number]> = []
    const ring = [seats[0], ...rotating]
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i]
      const b = ring[n - 1 - i]
      if (a !== ghost && b !== ghost) {
        // Alternate the listed order so nobody is always the first-named side.
        round.push(r % 2 === 0 ? [a, b] : [b, a])
      }
    }
    if (round.length > 0) rounds.push(round)
    rotating.unshift(rotating.pop() as number)
  }
  return rounds
}

/**
 * The group's players strongest first, or `undefined` unless every one of them
 * carries a rank.
 *
 * Read off the ranks rather than off the draw order, which is the same list only
 * until someone arranges the draw by hand. Players level on points keep the order the
 * draw gave them, which is already seeded, so the seeding stays deterministic without
 * reaching for the rng again.
 */
export function seedByRank(
  playerIds: readonly PlayerId[],
  ranks: Readonly<Record<PlayerId, number>> | undefined,
): PlayerId[] | undefined {
  if (!ranks || playerIds.length === 0) return undefined
  if (playerIds.some((id) => ranks[id] === undefined)) return undefined

  return playerIds
    .map((id, drawnAt) => ({ id, drawnAt }))
    .sort((x, y) => ranks[y.id] - ranks[x.id] || x.drawnAt - y.drawnAt)
    .map((entry) => entry.id)
}

/**
 * The match that has to be played last, or `undefined` when nothing rides on the
 * closing match and the order is free.
 *
 * One qualifier means the top two decide it between them; two means second place is
 * decided by seeds 2 and 3, the first and the last being expected to have settled
 * their own fate already. Past that the regulation says nothing, and neither does
 * this: a group where three of five go through has no single deciding match to
 * protect.
 */
export function deciderSeeds(size: number, advance: number): SeedPair | undefined {
  if (advance >= size) return undefined
  if (advance === 1 && size >= 2) return [1, 2]
  if (advance === 2 && size >= 3) return [2, 3]
  return undefined
}

const samePair = (x: SeedPair, y: SeedPair): boolean =>
  (x[0] === y[0] && x[1] === y[1]) || (x[0] === y[1] && x[1] === y[0])

/** The seed both matches contain, if they share one. Two fixtures share at most one. */
function sharedSeed(x: SeedPair, y: SeedPair): number | undefined {
  if (x[0] === y[0] || x[0] === y[1]) return x[0]
  if (x[1] === y[0] || x[1] === y[1]) return x[1]
  return undefined
}

/**
 * What it costs to play `y` straight after `x`.
 *
 * Two objectives in one integer, so the search can compare plans by a single number
 * and still never trade the important one away. A repeat costs more than every
 * tiebreak in the plan put together, so the count of back-to-back matches is always
 * settled first; what is left over ranks the repeats by who has to play them, and
 * charges most for the strongest player. Where a repeat cannot be avoided it should
 * fall on the player likelier to have just lost, and before a ball is struck the
 * weaker seed is the only reading of that available.
 */
function boundaryCost(x: SeedPair, y: SeedPair, size: number): number {
  const seed = sharedSeed(x, y)
  if (seed === undefined) return 0
  return size * size + 1 + (size + 1 - seed)
}

interface Cell {
  cost: number
  /** Which match closed the previous round on the best path to here. */
  from: number
  /** Which match opens this round on that path. */
  first: number
}

/**
 * Choose which match opens and which closes each round, for a fixed order of rounds.
 *
 * Within a round no two matches share a player, so a repeat can only happen across a
 * round boundary — which is why the first and last match of each round are the only
 * choices that matter, and why the middle of a round can be left in the order the
 * circle method produced. That turns an intractable search over every permutation of
 * the matches into a short walk over the rounds: exact rather than approximate, and
 * quick enough to run inside a recompute.
 */
function planRounds(
  rounds: readonly (readonly SeedPair[])[],
  size: number,
  decider: SeedPair | undefined,
): { cost: number; rounds: SeedPair[][] } {
  const k = rounds.length
  const closing = rounds[k - 1]
  // The decider closes the group, so it closes the round the group closes with.
  const forced = decider ? closing.findIndex((pair) => samePair(pair, decider)) : -1

  const allowed = (i: number, last: number) => i !== k - 1 || forced < 0 || last === forced
  const opener = (i: number, last: number) => (rounds[i].length === 1 ? last : last === 0 ? 1 : 0)

  const tables: Cell[][] = [
    rounds[0].map((_, last) =>
      allowed(0, last)
        ? { cost: 0, from: -1, first: opener(0, last) }
        : { cost: INF, from: -1, first: -1 },
    ),
  ]

  for (let i = 1; i < k; i++) {
    const previous = tables[i - 1]
    const cells: Cell[] = rounds[i].map(() => ({ cost: INF, from: -1, first: -1 }))
    for (let last = 0; last < rounds[i].length; last++) {
      if (!allowed(i, last)) continue
      for (let first = 0; first < rounds[i].length; first++) {
        if (first === last && rounds[i].length > 1) continue
        for (let before = 0; before < previous.length; before++) {
          if (previous[before].cost === INF) continue
          const cost =
            previous[before].cost + boundaryCost(rounds[i - 1][before], rounds[i][first], size)
          if (cost < cells[last].cost) cells[last] = { cost, from: before, first }
        }
      }
    }
    tables.push(cells)
  }

  const final = tables[k - 1]
  let bestLast = -1
  for (let i = 0; i < final.length; i++) {
    if (bestLast < 0 || final[i].cost < final[bestLast].cost) bestLast = i
  }
  // No path at all would mean a round with no permissible closing match, which the
  // rules above cannot produce. Hand back the rounds as drawn rather than something
  // malformed, and let the caller's cost comparison discard this candidate.
  if (bestLast < 0 || final[bestLast].cost === INF) {
    return { cost: INF, rounds: rounds.map((round) => round.slice()) }
  }

  const firsts = new Array<number>(k)
  const lasts = new Array<number>(k)
  let cursor = bestLast
  for (let i = k - 1; i >= 0; i--) {
    lasts[i] = cursor
    firsts[i] = tables[i][cursor].first
    cursor = tables[i][cursor].from
  }

  return {
    cost: final[bestLast].cost,
    rounds: rounds.map((round, i) => {
      const first = firsts[i]
      const last = lasts[i]
      if (first === last) return [round[first]]
      const middle = round
        .map((_, index) => index)
        .filter((index) => index !== first && index !== last)
      return [first, ...middle, last].map((index) => round[index])
    }),
  }
}

/** Every ordering of the rounds, generated in a fixed order so ties break the same way. */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()]
  const out: T[][] = []
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)]
    for (const tail of permutations(rest)) out.push([items[i], ...tail])
  }
  return out
}

function countBackToBack(rounds: readonly (readonly SeedPair[])[]): number {
  const flat = rounds.flat()
  let count = 0
  for (let i = 1; i < flat.length; i++) {
    if (sharedSeed(flat[i - 1], flat[i]) !== undefined) count++
  }
  return count
}

/** Cut a flat order into the largest batches that can share the tables. */
function intoBatches(order: readonly SeedPair[]): SeedPair[][] {
  const rounds: SeedPair[][] = []
  let batch: SeedPair[] = []
  let busy = new Set<number>()
  for (const pair of order) {
    if (busy.has(pair[0]) || busy.has(pair[1])) {
      rounds.push(batch)
      batch = []
      busy = new Set<number>()
    }
    batch.push(pair)
    busy.add(pair[0])
    busy.add(pair[1])
  }
  if (batch.length > 0) rounds.push(batch)
  return rounds
}

/** A published order is trusted only once it is shown to be a whole round robin. */
function coversEveryPair(order: readonly SeedPair[], size: number): boolean {
  if (order.length !== (size * (size - 1)) / 2) return false
  const seen = new Set<string>()
  for (const [a, b] of order) {
    if (a === b || a < 1 || b < 1 || a > size || b > size) return false
    seen.add(a < b ? `${a}:${b}` : `${b}:${a}`)
  }
  return seen.size === order.length
}

/**
 * Plan the running order of a group of `size` players from which `advance` qualify.
 *
 * Pure in its two numbers, so the same group is always played in the same order and
 * the plan can be recomputed rather than stored.
 *
 * The search is over the order of the circle method's rounds and over which match
 * opens and closes each of them — never over the matches themselves, which for a
 * group of six would be fifteen factorial arrangements. Keeping the rounds whole is
 * also what guarantees a batch can go on the tables together whatever the table count
 * is: the circle method never puts a player in a round twice, and nothing here moves
 * a match out of the round it was drawn in.
 *
 * Only the small groups have their round order searched exhaustively. From six
 * players up every round holds three matches or more, which is enough slack for the
 * walk over boundaries to find a plan with no repeat in it at all, and the order the
 * rounds arrive in stops mattering.
 */
export function scheduleGroup(
  size: number,
  advance: number,
  overrides?: PublishedOrders,
): GroupSchedule {
  if (size < 2) return { rounds: [], backToBack: 0 }

  const published = overrides?.[`${size}:${advance}`]
  if (published && coversEveryPair(published, size)) {
    const rounds = intoBatches(published)
    return { rounds, backToBack: countBackToBack(rounds) }
  }

  const drawn = circleRounds(size).map((round) => round.map(([a, b]) => [a + 1, b + 1] as SeedPair))
  const decider = deciderSeeds(size, advance)
  const deciderRound = decider
    ? drawn.findIndex((round) => round.some((pair) => samePair(pair, decider)))
    : -1

  const head = drawn.filter((_, i) => i !== deciderRound)
  const tail = deciderRound >= 0 ? [drawn[deciderRound]] : []
  const widest = Math.max(...drawn.map((round) => round.length))
  const candidates =
    widest <= 2 ? permutations(head).map((order) => [...order, ...tail]) : [[...head, ...tail]]

  let best = planRounds(candidates[0], size, decider)
  for (let i = 1; i < candidates.length; i++) {
    const plan = planRounds(candidates[i], size, decider)
    if (plan.cost < best.cost) best = plan
  }

  return { rounds: best.rounds, backToBack: countBackToBack(best.rounds) }
}
