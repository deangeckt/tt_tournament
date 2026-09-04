import type { TFunction } from 'i18next'
import type { Participant } from '../../engine/resolve'
import type { Group, PlayerId } from '../../engine/types'

/** Human-readable name for a match slot, including "winner of ..." placeholders. */
export function participantLabel(
  participant: Participant,
  nameOf: (id: PlayerId) => string,
  groups: readonly Group[],
  t: TFunction,
): string {
  switch (participant.kind) {
    case 'player':
      return nameOf(participant.playerId)
    case 'bye':
      return t('match.bye')
    case 'vacant':
      return t('match.vacant')
    case 'tbd': {
      const from = participant.from
      if (from.kind === 'groupRank') {
        const group = groups.find((g) => g.id === from.groupId)
        return t('match.groupRank', { rank: from.rank, group: group?.name ?? '' })
      }
      return t('match.pending')
    }
  }
}

/**
 * Name a knockout round the way a room full of players would: the last round is the
 * final, the one before it the semis, and so on. A bare round number tells nobody
 * anything — "Round 3" means something different in every bracket size.
 */
export function roundLabel(round: number, lastRound: number, t: TFunction): string {
  const remaining = lastRound - round
  switch (remaining) {
    case 0:
      return t('round.final')
    case 1:
      return t('round.semi')
    case 2:
      return t('round.quarter')
    case 3:
      return t('round.last16')
    default:
      // 2^(remaining+1) players are still in at the start of this round.
      return t('round.of', { n: 2 ** (remaining + 1) })
  }
}
