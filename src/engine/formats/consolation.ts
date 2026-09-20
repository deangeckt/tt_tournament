import type { FormatConfig, Group, Level, LevelId, Match, PlayerId, Slot } from '../types'
import { consolationConfig } from '../advisor'
import { bracketMatchId } from './singleElim'

/**
 * The consolation — בית ניחומים — is the second competition the players the main
 * draw eliminates go on to play, in the same format the main draw used.
 *
 * It is not stored. A level keeps one boolean on its config and everything here is
 * derived from it, which is what lets the consolation be switched on halfway through
 * a night without renaming a single match of the main draw.
 *
 * Two shapes, because the two formats eliminate people at different moments:
 *
 * - **Groups then knockout.** The group stage is the elimination event: everyone it
 *   knocks out is known at once, so they are re-drawn as a competition of their own
 *   and play it alongside the main bracket. That draw needs *concrete players*, so it
 *   can only be made once every main group has finished — see `consolationLevel`.
 * - **Single elimination.** Losers arrive in waves, so the consolation is a staggered
 *   bracket fed by `loserOf` references and exists from the moment of the draw. See
 *   `generateConsolationBracket`.
 */

/** The synthetic level id a consolation is drawn under, so its ids cannot collide. */
export function consolationLevelId(levelId: LevelId): LevelId {
  return `${levelId}:c`
}

/**
 * Whether this configuration asks for a consolation.
 *
 * Narrows the union in one place, so nothing else has to know which formats carry the
 * flag — a round robin eliminates nobody, and double elimination already is one.
 */
export function hasConsolation(config: FormatConfig): boolean {
  return (
    (config.format === 'singleElim' || config.format === 'groupsKnockout') &&
    config.consolation === true
  )
}

/**
 * The level a consolation is drawn as: same night, same frozen ranks, different field.
 *
 * Handing this to `buildFixtures` is the whole trick — the consolation gets the banded
 * draw, the ITTF running order, the group standings and the bye padding for nothing,
 * because it goes down the same code path the main draw does.
 *
 * Two deliberate departures from the level it comes from:
 *
 * - **`manualOrder` is dropped.** It holds main-draw ids; left in place,
 *   `levelDrawOrder` would reconcile it down to whichever of those players happen to
 *   be in the consolation and hand back a half-hand-made draw nobody asked for.
 * - **The field is sorted by id before it is drawn.** The draw must depend on *who*
 *   went out and not on the order they were listed in, or correcting a group result
 *   that merely re-orders a table — without changing who qualified — would re-draw the
 *   whole consolation and detach every result in it. Same reasoning as the lot in
 *   `standings.ts`, which sorts its seed input for the same protection.
 */
export function consolationLevel(level: Level, field: readonly PlayerId[]): Level | null {
  const config = consolationConfig(level.config, field.length)
  if (!config) return null

  return {
    ...level,
    id: consolationLevelId(level.id),
    playerIds: [...field].sort(),
    config,
    seed: `${level.seed}:c`,
    manualOrder: undefined,
  }
}

/** Stamp generated fixtures as the consolation's, and hand them back to the real level. */
export function tagConsolation(
  levelId: LevelId,
  fixtures: { groups: Group[]; matches: Match[] },
): { groups: Group[]; matches: Match[] } {
  return {
    groups: fixtures.groups.map((group) => ({ ...group, levelId, consolation: true as const })),
    matches: fixtures.matches.map((match) => ({ ...match, levelId, consolation: true as const })),
  }
}

/**
 * How a winners-bracket round's losers are dealt into the consolation round that
 * receives them.
 *
 * This one permutation is the whole difficulty of a staggered losers bracket, and the
 * first drop is the case that can be settled by argument rather than by testing.
 * Winners round 1 match `j` is contested by the winners of round 0 matches `2j` and
 * `2j+1`; the consolation's opening match `j` is contested by the *losers* of those
 * same two. Dealt straight across, the round 1 loser meets someone they have already
 * beaten half the time. Reversed, the indices can never coincide, so it never happens.
 *
 * Later drops cannot be made rematch-proof, and it is worth being plain about that
 * rather than claiming otherwise: by the second drop a survivor's possible origins
 * span the whole draw, so no permutation separates them. What is left is to admit as
 * few repeats as possible, which is a measurement rather than an argument. Playing out
 * every combination of outcomes:
 *
 * |                     | 8 players    | 16 players       |
 * | ------------------- | ------------ | ---------------- |
 * | alternating (this)  | 32 / 128     | 12,288 / 32,768  |
 * | reverse every round | 32 / 128     | 16,384 / 32,768  |
 * | straight across     | 96 / 128     | 32,256 / 32,768  |
 *
 * — and straight across puts 96 of its 128 in the *first* drop, which is the one that
 * is avoidable. `consolation.test.ts` holds the zero and the ceiling in place.
 */
export function dropOrder<T>(drops: readonly T[], winnersRound: number): T[] {
  return winnersRound % 2 === 1 ? [...drops].reverse() : [...drops]
}

/**
 * The staggered consolation bracket for a single-elimination main draw.
 *
 * Alternating rounds: the survivors play each other, then the next winners round's
 * losers drop in beside them, until one is left. Losers are taken from every winners
 * round *except the last* — that one is the final, and its loser is the runner-up, who
 * keeps second place rather than going down for a second prize.
 *
 * Byes need no handling here at all. A main-draw match won on a bye resolves `auto`,
 * and `resolve.ts` already reads `loserOf` on an `auto` match as a vacancy — so no
 * phantom drops in and the consolation opponent simply walks over.
 */
export function generateConsolationBracket(levelId: LevelId, main: readonly Match[]): Match[] {
  const byRound = new Map<number, Match[]>()
  for (const match of main) {
    if (match.stage !== 'winners' || match.consolation) continue
    const round = byRound.get(match.round)
    if (round) round.push(match)
    else byRound.set(match.round, [match])
  }

  const rounds = [...byRound.keys()].sort((x, y) => x - y)
  // A one-round main draw is a final and nothing else; there is nobody to pick up.
  if (rounds.length < 2) return []
  for (const round of rounds) byRound.get(round)!.sort((x, y) => x.order - y.order)

  const matches: Match[] = []
  let round = 0

  const losersOf = (winnersRound: number): Slot[] =>
    byRound.get(rounds[winnersRound])!.map((match) => ({ kind: 'loserOf', matchId: match.id }))

  const emit = (a: Slot, b: Slot, order: number): Slot => {
    const id = bracketMatchId(levelId, 'losers', round, order)
    matches.push({ id, levelId, stage: 'losers', round, order, a, b, consolation: true })
    return { kind: 'winnerOf', matchId: id }
  }

  let current = losersOf(0)
  // The last winners round is the final; its loser stays out.
  const lastFeeder = rounds.length - 2
  let feeder = 1

  while (current.length > 1) {
    const survivors: Slot[] = []
    for (let i = 0; i < current.length; i += 2) {
      survivors.push(emit(current[i], current[i + 1], survivors.length))
    }
    current = survivors
    round++

    if (feeder <= lastFeeder) {
      const drops = dropOrder(losersOf(feeder), feeder)
      current = current.map((slot, i) => emit(slot, drops[i], i))
      round++
      feeder++
    }
  }

  return matches
}
