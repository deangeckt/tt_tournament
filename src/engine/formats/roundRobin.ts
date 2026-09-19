import type { Group, LevelId, Match, MatchId, PlayerId } from '../types'
import { circleRounds, scheduleGroup, type PublishedOrders } from '../schedule'

/**
 * Pair everyone exactly once, arranged into rounds where each player appears at most
 * once. Round structure matters for table scheduling — it is a set of matches that
 * can all be played simultaneously.
 *
 * The circle method itself lives in `schedule.ts`, over seat numbers rather than
 * players, because the planner needs the same arrangement over seeds. One
 * implementation, two readings of it.
 */
export function roundRobinRounds(playerIds: readonly PlayerId[]): Array<Array<[PlayerId, PlayerId]>> {
  return circleRounds(playerIds.length).map((round) =>
    round.map(([a, b]) => [playerIds[a], playerIds[b]] as [PlayerId, PlayerId]),
  )
}

/**
 * Match ids must be stable across recomputes — results are keyed by them.
 *
 * The coordinates are the ones the *draw* produced, never the ones the running order
 * hands out. A group's matches are the same matches whichever sequence they are
 * played in, so planning the sequence — or improving the plan in a later version, or
 * a rank arriving that switches the planner on — must not rename a single one of
 * them and detach the results already stored against them.
 */
export function groupMatchId(groupId: string, round: number, order: number): string {
  return `${groupId}:r${round}:m${order}`
}

/** A generated pairing, before it is given a place in the running order. */
interface Fixture {
  id: MatchId
  a: PlayerId
  b: PlayerId
}

export interface GroupOrdering {
  /**
   * The group's players strongest first. Absent — which is every group holding
   * anyone unranked — leaves the matches in the order the draw made them.
   */
  seeded?: readonly PlayerId[]
  /** How many players go through, which decides the match that has to be played last. */
  advance: number
  /** A running order published by a league, if the club has one. */
  orders?: PublishedOrders
}

const pairKey = (a: PlayerId, b: PlayerId): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

/**
 * Lay the generated fixtures out in the planned running order.
 *
 * The planner works in seeds and knows nothing of this group, so its answer is read
 * back through the seeding to find the fixture each planned match refers to. Any
 * fixture it fails to name would mean the plan and the draw disagree about which
 * pairs exist, so the whole plan is dropped for the draw order rather than a group
 * being served half a schedule.
 */
function runningOrder(rounds: Fixture[][], ordering: GroupOrdering): Fixture[][] {
  const seeded = ordering.seeded
  const fixtures = rounds.flat()
  if (!seeded || seeded.length < 2) return rounds

  const byPair = new Map<string, Fixture>()
  for (const fixture of fixtures) byPair.set(pairKey(fixture.a, fixture.b), fixture)

  const planned: Fixture[][] = []
  let found = 0
  for (const round of scheduleGroup(seeded.length, ordering.advance, ordering.orders).rounds) {
    const batch: Fixture[] = []
    for (const [x, y] of round) {
      const fixture = byPair.get(pairKey(seeded[x - 1], seeded[y - 1]))
      if (!fixture) return rounds
      batch.push(fixture)
      found++
    }
    planned.push(batch)
  }
  return found === fixtures.length ? planned : rounds
}

export function generateGroupMatches(group: Group, ordering?: GroupOrdering): Match[] {
  const drawn: Fixture[][] = roundRobinRounds(group.playerIds).map((round, roundIndex) =>
    round.map(([a, b], order) => ({ id: groupMatchId(group.id, roundIndex, order), a, b })),
  )

  // `round` and `order` describe where a match sits in the running order — which
  // batch goes on the tables together, and where in that batch. The id above keeps
  // the draw's own coordinates, so the two are free to disagree.
  return (ordering ? runningOrder(drawn, ordering) : drawn).flatMap((round, roundIndex) =>
    round.map((fixture, order) => ({
      id: fixture.id,
      levelId: group.levelId,
      stage: 'group' as const,
      groupId: group.id,
      round: roundIndex,
      order,
      a: { kind: 'player' as const, playerId: fixture.a },
      b: { kind: 'player' as const, playerId: fixture.b },
    })),
  )
}

/** A flat round-robin level is modelled as a single group containing everyone. */
export function singleGroup(levelId: LevelId, name: string, playerIds: readonly PlayerId[]): Group {
  return { id: `${levelId}:g0`, levelId, name, playerIds: playerIds.slice() }
}
