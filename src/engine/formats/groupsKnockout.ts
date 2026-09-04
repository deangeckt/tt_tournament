import type { Group, LevelId, Match, PlayerId, Slot } from '../types'
import { nextPowerOfTwo, bracketSeedOrder, snakeIntoGroups } from '../draw'
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

/** Pad qualifier slots into a full bracket and arrange them by standard seeding. */
export function seedQualifiers(qualifiers: readonly Slot[]): Slot[] {
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
): GroupsKnockoutFixtures {
  const groups = buildGroups(levelId, orderedPlayers, groupCount)
  const groupMatches = groups.flatMap(generateGroupMatches)
  const bracket = generateSingleElim(levelId, seedQualifiers(qualifierSlots(groups, advancePerGroup)))
  return { groups, matches: [...groupMatches, ...bracket] }
}
