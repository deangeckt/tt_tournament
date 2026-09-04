import type { LevelId, Match, Slot, Stage } from '../types'

export function bracketMatchId(levelId: LevelId, stage: Stage, round: number, order: number): string {
  return `${levelId}:${stage}:r${round}:m${order}`
}

/**
 * Build an elimination tree over already-seeded slots.
 *
 * `slots` must have a power-of-two length (see seedBracketSlots). Later rounds
 * reference earlier matches via `winnerOf`, so the tree is fully declarative: no
 * result is baked into the fixture, and resolve.ts fills in the participants.
 */
export function generateSingleElim(
  levelId: LevelId,
  slots: readonly Slot[],
  stage: Stage = 'winners',
): Match[] {
  const matches: Match[] = []
  if (slots.length < 2) return matches

  let roundSize = slots.length / 2
  for (let order = 0; order < roundSize; order++) {
    matches.push({
      id: bracketMatchId(levelId, stage, 0, order),
      levelId,
      stage,
      round: 0,
      order,
      a: slots[order * 2],
      b: slots[order * 2 + 1],
    })
  }

  let round = 1
  while (roundSize > 1) {
    const prevRound = round - 1
    roundSize = roundSize / 2
    for (let order = 0; order < roundSize; order++) {
      matches.push({
        id: bracketMatchId(levelId, stage, round, order),
        levelId,
        stage,
        round,
        order,
        a: { kind: 'winnerOf', matchId: bracketMatchId(levelId, stage, prevRound, order * 2) },
        b: { kind: 'winnerOf', matchId: bracketMatchId(levelId, stage, prevRound, order * 2 + 1) },
      })
    }
    round++
  }

  return matches
}

/** Number of rounds an elimination bracket of this slot count will have. */
export function bracketRounds(slotCount: number): number {
  return Math.max(0, Math.log2(slotCount))
}
