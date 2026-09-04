import type { TFunction } from 'i18next'
import type { PlayerId, Tournament } from '../engine/types'
import { resolveLevel } from '../engine/resolve'

/**
 * A plain-text results summary — the thing that actually gets pasted into the club's
 * WhatsApp group five minutes after the final.
 *
 * Recomputed from the tournament like everything else, so it cannot disagree with
 * the tables on screen.
 */
export function summaryText(tournament: Tournament, t: TFunction): string {
  const nameOf = (id: PlayerId) => tournament.players.find((p) => p.id === id)?.name ?? id
  const lines = [`🏓 ${tournament.name} — ${tournament.date}`]

  for (const level of tournament.levels) {
    const view = resolveLevel(level, tournament.results, tournament.scoreMode)
    if (tournament.levels.length > 1) lines.push('', level.name)
    if (view.champion) lines.push(`🏆 ${nameOf(view.champion)}`)

    for (const group of view.groups) {
      const rows = view.standings.get(group.id) ?? []
      if (rows.length === 0) continue
      lines.push(
        view.groups.length > 1 ? t('draw.inGroup', { group: group.name }) : t('run.standings'),
      )
      for (const row of rows) lines.push(`${row.rank}. ${nameOf(row.playerId)}`)
    }
  }

  return lines.join('\n')
}
