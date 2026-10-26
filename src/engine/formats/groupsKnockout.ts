import type { Group, GroupId, LevelId, Match, PlayerId, Slot } from '../types'
import { nextPowerOfTwo, bracketSeedOrder, snakeIntoGroups } from '../draw'
import { seedByRank } from '../schedule'
import { generateGroupMatches } from './roundRobin'
import { generateSingleElim } from './singleElim'

const GROUP_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function buildGroups(
  levelId: LevelId,
  orderedPlayers: readonly PlayerId[],
  groupCount: number,
): Group[] {
  return snakeIntoGroups(orderedPlayers, groupCount).map((playerIds, i) => ({
    id: `${levelId}:g${i}`,
    levelId,
    name: GROUP_LABELS[i] ?? `G${i + 1}`,
    playerIds,
  }))
}

/**
 * Order the qualifying slots: all group winners first (by group), then all
 * runners-up, and so on. This is the seeding order the bracket then draws from.
 */
export function qualifierSlots(groups: readonly Group[], advancePerGroup: number): Slot[] {
  const slots: Slot[] = []
  for (let rank = 1; rank <= advancePerGroup; rank++) {
    for (const group of groups) {
      slots.push({ kind: 'groupRank', groupId: group.id, rank })
    }
  }
  return slots
}

function sameGroup(x: Slot, y: Slot): boolean {
  return x.kind === 'groupRank' && y.kind === 'groupRank' && x.groupId === y.groupId
}

/**
 * Stop two players from the same group meeting again in the first knockout round.
 *
 * Standard seeding mostly avoids this on its own, but not always: with an odd number
 * of groups the middle group's winner and runner-up land on seeds that pair together.
 * Rather than deriving a closed-form ordering that holds for every combination of
 * group count, qualifiers and byes, repair the arrangement directly — swap the
 * offending slot with another qualifier of the same rank, provided the swap does not
 * create a fresh clash. Deterministic, and easy to prove correct by testing.
 */
export function repairGroupClashes(slots: Slot[]): Slot[] {
  const out = slots.slice()
  const clashAt = (i: number) => sameGroup(out[i], out[i ^ 1])

  for (let i = 0; i < out.length; i++) {
    if (!clashAt(i)) continue
    const current = out[i]
    if (current.kind !== 'groupRank') continue

    for (let j = 0; j < out.length; j++) {
      const candidate = out[j]
      if (j === i || j === (i ^ 1)) continue
      // Only swap like for like, so the seeding structure is preserved.
      if (candidate.kind !== 'groupRank' || candidate.rank !== current.rank) continue
      // The swap must fix this pair without breaking the one we take from.
      if (sameGroup(candidate, out[i ^ 1])) continue
      if (sameGroup(current, out[j ^ 1])) continue

      out[i] = candidate
      out[j] = current
      break
    }
  }
  return out
}

/** Far more than any field the format picker can produce needs; see separateGroupmates. */
const SEPARATION_BUDGET = 100_000

/**
 * Keep the players one group sends through apart for as long as the bracket allows.
 *
 * Two from a group can meet only in the final: the runner-up goes into the half its
 * group winner is not in. Four can meet no earlier than the semi-finals: each has a
 * quarter of its own, and the first two are still in opposite halves. In general the
 * qualifier ranked `r` in its group sits in a different block of `size /
 * nextPowerOfTwo(r)` seats from every groupmate ranked above it — halves for the
 * second, quarters for the third and fourth. That is the ITTF draw rule for a group
 * stage feeding a knockout, and what `repairGroupClashes` only ever promised for the
 * first round: with four groups, standard seeding puts A1 and A2 in the same half,
 * one semi-final away from playing each other again.
 *
 * Winners keep the seats standard seeding gave them, byes included, and every move is
 * like for like — a runner-up only trades places with another runner-up — so the
 * bracket is still seeded. Each seat keeps the qualifier seeding put there if that
 * one fits, and otherwise takes the first that does in group order, so the result is
 * deterministic and is the plain seeded bracket wherever that already kept groups
 * apart.
 *
 * A search rather than a formula, because a seat handed out early can leave a later
 * group with nowhere to go; it backtracks. Null if no arrangement exists or the search
 * outruns its budget — the tests sweep every field the format picker can produce and
 * find one every time, in under fifty steps, so the budget guards against a config made
 * by hand, not against a club night.
 */
export function separateGroupmates(qualifiers: readonly Slot[]): Slot[] | null {
  const size = nextPowerOfTwo(Math.max(qualifiers.length, 2))
  const order = bracketSeedOrder(size)
  const seatOf: number[] = []
  order.forEach((seedNumber, seat) => {
    seatOf[seedNumber - 1] = seat
  })

  const out: Slot[] = order.map((seedNumber) => qualifiers[seedNumber - 1] ?? { kind: 'bye' as const })
  // Where each group's qualifiers sit so far: the winner from the start, the rest as
  // the search places them. Qualifiers arrive rank by rank, so whenever one is placed
  // every groupmate ranked above it already has a seat.
  const seated = new Map<GroupId, number[]>()
  const groupOrder: GroupId[] = []
  const open: number[] = []
  const unplaced = new Set<string>()
  qualifiers.forEach((slot, i) => {
    if (slot.kind !== 'groupRank') return
    if (slot.rank === 1) {
      seated.set(slot.groupId, [seatOf[i]])
      groupOrder.push(slot.groupId)
    } else {
      open.push(i)
      unplaced.add(`${slot.rank}:${slot.groupId}`)
    }
  })

  let budget = SEPARATION_BUDGET
  const fill = (next: number): boolean => {
    if (next === open.length) return true
    if (--budget < 0) return false

    const seedIndex = open[next]
    const slot = qualifiers[seedIndex]
    if (slot.kind !== 'groupRank') return false
    const seat = seatOf[seedIndex]
    const apart = size / nextPowerOfTwo(slot.rank)

    const candidates = [slot.groupId, ...groupOrder.filter((id) => id !== slot.groupId)]
    for (const groupId of candidates) {
      const key = `${slot.rank}:${groupId}`
      const seats = seated.get(groupId)
      if (!unplaced.has(key) || !seats) continue
      // Two seats share a block of `apart` exactly when they differ only below it.
      if (seats.some((other) => (other ^ seat) < apart)) continue

      unplaced.delete(key)
      seats.push(seat)
      out[seat] = { kind: 'groupRank', groupId, rank: slot.rank }
      if (fill(next + 1)) return true
      seats.pop()
      unplaced.add(key)
    }
    return false
  }

  return fill(0) ? out : null
}

/**
 * Pad qualifier slots into a full bracket and arrange them by standard seeding.
 *
 * `separate` keeps each group's qualifiers apart until as late a round as the bracket
 * allows (see separateGroupmates); without it only the first round is protected, which
 * is how every level drawn before `separateGroups` existed was seeded and must stay.
 */
export function seedQualifiers(qualifiers: readonly Slot[], separate = false): Slot[] {
  if (separate) {
    const apart = separateGroupmates(qualifiers)
    if (apart) return apart
  }
  const size = nextPowerOfTwo(Math.max(qualifiers.length, 2))
  const order = bracketSeedOrder(size)
  const seeded = order.map((seedNumber) => qualifiers[seedNumber - 1] ?? { kind: 'bye' as const })
  return repairGroupClashes(seeded)
}

export interface GroupsKnockoutFixtures {
  groups: Group[]
  matches: Match[]
}

export function buildGroupsKnockout(
  levelId: LevelId,
  orderedPlayers: readonly PlayerId[],
  groupCount: number,
  advancePerGroup: number,
  /** The ranks the level was drawn against; they plan each group's running order. */
  ranks?: Readonly<Record<PlayerId, number>>,
  /** Keep groupmates apart past the first round. See `FormatConfig.separateGroups`. */
  separateGroups = false,
): GroupsKnockoutFixtures {
  const groups = buildGroups(levelId, orderedPlayers, groupCount)
  // Each group is planned on its own: a group where everyone is ranked gets the
  // running order, one still holding an unranked player keeps the draw order.
  const groupMatches = groups.flatMap((group) =>
    generateGroupMatches(group, {
      seeded: seedByRank(group.playerIds, ranks),
      advance: advancePerGroup,
    }),
  )
  const bracket = generateSingleElim(
    levelId,
    seedQualifiers(qualifierSlots(groups, advancePerGroup), separateGroups),
  )
  return { groups, matches: [...groupMatches, ...bracket] }
}
