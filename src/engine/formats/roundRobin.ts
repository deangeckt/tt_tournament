import type { Group, LevelId, Match, PlayerId } from '../types'

/** Sentinel used to give one player a rest when the count is odd. */
const REST = '__rest__'

/**
 * Circle method: pair everyone exactly once, arranged into rounds where each player
 * appears at most once per round. Round structure matters for table scheduling — it
 * lets the app suggest a set of matches that can all be played simultaneously.
 */
export function roundRobinRounds(playerIds: readonly PlayerId[]): Array<Array<[PlayerId, PlayerId]>> {
  const players = playerIds.slice()
  if (players.length % 2 === 1) players.push(REST)

  const n = players.length
  const rounds: Array<Array<[PlayerId, PlayerId]>> = []
  if (n < 2) return rounds

  const rotating = players.slice(1)
  for (let r = 0; r < n - 1; r++) {
    const round: Array<[PlayerId, PlayerId]> = []
    const ring = [players[0], ...rotating]
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i]
      const b = ring[n - 1 - i]
      if (a !== REST && b !== REST) {
        // Alternate the listed order so nobody is always the first-named side.
        round.push(r % 2 === 0 ? [a, b] : [b, a])
      }
    }
    if (round.length > 0) rounds.push(round)
    rotating.unshift(rotating.pop() as PlayerId)
  }
  return rounds
}

/** Match ids must be stable across recomputes — results are keyed by them. */
export function groupMatchId(groupId: string, round: number, order: number): string {
  return `${groupId}:r${round}:m${order}`
}

export function generateGroupMatches(group: Group): Match[] {
  const matches: Match[] = []
  roundRobinRounds(group.playerIds).forEach((round, roundIndex) => {
    round.forEach(([a, b], order) => {
      matches.push({
        id: groupMatchId(group.id, roundIndex, order),
        levelId: group.levelId,
        stage: 'group',
        groupId: group.id,
        round: roundIndex,
        order,
        a: { kind: 'player', playerId: a },
        b: { kind: 'player', playerId: b },
      })
    })
  })
  return matches
}

/** A flat round-robin level is modelled as a single group containing everyone. */
export function singleGroup(levelId: LevelId, name: string, playerIds: readonly PlayerId[]): Group {
  return { id: `${levelId}:g0`, levelId, name, playerIds: playerIds.slice() }
}
