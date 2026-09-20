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
    const view = resolveLevel(level, tournament.results)
    if (tournament.levels.length > 1) lines.push('', level.name)
    if (view.champion) lines.push(`🏆 ${nameOf(view.champion)}`)
    // A night with a consolation has two winners, and the group that reads this is
    // exactly the one the second name matters to.
    if (view.consolationChampion) {
      lines.push(`${t('run.consolation')}: ${nameOf(view.consolationChampion)}`)
    }

    // The main draw's tables. The consolation's are left out on purpose: this is a
    // message, and its job is the result, not every table of the evening.
    const groups = view.groups.filter((g) => !g.consolation)
    for (const group of groups) {
      const rows = view.standings.get(group.id) ?? []
      if (rows.length === 0) continue
      lines.push(groups.length > 1 ? t('draw.inGroup', { group: group.name }) : t('run.standings'))
      for (const row of rows) lines.push(`${row.rank}. ${nameOf(row.playerId)}`)
    }
  }

  return lines.join('\n')
}
