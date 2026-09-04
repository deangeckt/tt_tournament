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
