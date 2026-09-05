import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import type { StandingRow } from '../../engine/standings'
import type { PlayerId } from '../../engine/types'
import { Button, Score } from '../common/ui'
import { Tooltip } from '../common/Tooltip'

export function GroupTable({
  title,
  rows,
  nameOf,
  advancing = 0,
  onResolveTie,
}: {
  title: string
  rows: StandingRow[]
  nameOf: (id: PlayerId) => string
  /** How many top rows qualify, drawn with a marker down the side. */
  advancing?: number
  /**
   * Offered per dead heat that only lacks game scores. Omitted on read-only screens,
   * where the hint still explains the lot but has nothing to offer.
   */
  onResolveTie?: (players: readonly PlayerId[]) => void
}) {
  const { t } = useTranslation()

  // The hint below is the one thing in this table the user can act on, so it is not
  // left in a hover-only tooltip: on a phone at the club nobody has a pointer.
  //
  // One table can hold more than one such tie, and they are separate jobs with
  // separate matches, so each gets its own button rather than one that would have to
  // guess which tie was meant. Deduplicated by membership: every player in a dead
  // heat carries the same group.
  const ties = new Map<string, readonly PlayerId[]>()
  for (const row of rows) {
    if (row.tiebreakReason === 'lotPointsUnavailable' && row.tieGroup) {
      ties.set(row.tieGroup.join('|'), row.tieGroup)
    }
  }

  return (
    <div className="print-keep overflow-hidden rounded-2xl bg-white ring-1 ring-court-100 dark:bg-court-900 dark:ring-court-800">
      <div className="border-b border-court-100 px-4 py-3 text-lg font-bold dark:border-court-800">
        {title}
      </div>
      {/* On a phone the "played" column is the least load-bearing — wins, games and
          points are what people read — so it is dropped below sm rather than forcing
          the whole table to scroll sideways. */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="text-sm text-court-500 dark:text-court-300">
            <tr>
              <th className="px-2 py-2.5 text-center font-medium">
                <ColumnHead label={t('table.rank')} hint={t('table.rankHint')} />
              </th>
              <th className="px-2 py-2.5 text-start font-medium">{t('table.player')}</th>
              <th className="hidden px-2 py-2.5 text-center font-medium sm:table-cell">
                <ColumnHead label={t('table.played')} hint={t('table.playedHint')} />
              </th>
              <th className="px-2 py-2.5 text-center font-medium">
                <ColumnHead label={t('table.won')} hint={t('table.wonHint')} />
              </th>
              <th className="px-2 py-2.5 text-center font-medium">
                <ColumnHead label={t('table.games')} hint={t('table.gamesHint')} />
              </th>
              <th className="px-2 py-2.5 text-center font-medium">
                <ColumnHead label={t('table.points')} hint={t('table.pointsHint')} />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const qualifies = advancing > 0 && row.rank <= advancing
              return (
                // `layout` makes a player physically slide up or down the table when a
                // result changes the order — the clearest possible signal that the tap
                // did something.
                <motion.tr
                  key={row.playerId}
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  className={`border-t border-court-50 dark:border-court-800 ${
                    qualifies ? 'bg-court-500/8' : ''
                  }`}
                >
                  <td className="relative px-2 py-3 text-center tabular-nums">
                    {qualifies ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 start-0 w-1 bg-court-500"
                      />
                    ) : null}
                    {row.rank}
                  </td>
                  <td className="px-2 py-3">
                    <span className="font-medium">{nameOf(row.playerId)}</span>
                    {row.tiebreakReason ? (
                      <Tooltip label={t(`tiebreak.${row.tiebreakReason}`)}>
                        <span className="ms-1.5 cursor-help text-sm text-court-400">ⓘ</span>
                      </Tooltip>
                    ) : null}
                  </td>
                  <td className="hidden px-2 py-3 text-center tabular-nums sm:table-cell">
                    {row.played}
                  </td>
                  <td className="px-2 py-3 text-center tabular-nums">{row.won}</td>
                  <td className="px-2 py-3 text-center">
                    {/* Won-then-lost, which in RTL means the games won sit on the
                        right — where the eye starts — not on the left. */}
                    <Score a={row.gamesFor} b={row.gamesAgainst} sep=":" />
                  </td>
                  <td className="px-2 py-3 text-center font-bold tabular-nums">
                    {row.matchPoints}
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {ties.size > 0 ? (
        <div className="space-y-2 border-t border-court-100 bg-court-50 px-4 py-3 dark:border-court-800 dark:bg-court-800/50">
          <p className="text-sm text-court-600 dark:text-court-200">{t('tiebreak.pointsHint')}</p>
          {onResolveTie
            ? [...ties.values()].map((group) => (
                <Button
                  key={group.join('|')}
                  variant="subtle"
                  size="sm"
                  className="w-full"
                  onClick={() => onResolveTie(group)}
                >
                  {t('tiebreak.resolveFor', { names: group.map(nameOf).join(', ') })}
                </Button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  )
}

/**
 * A column heading that explains itself on hover.
 *
 * These headings are abbreviations of a rule — "games" is a won-and-lost pair summed
 * over every match, and a game taken in a lost match still counts — and a three-letter
 * label cannot carry that. The dotted underline is what says an explanation exists;
 * without it a hover-only bubble is one nobody thinks to look for. The heading itself
 * stays legible on its own, so a phone, where nothing hovers, loses the footnote and
 * not the table.
 */
function ColumnHead({ label, hint }: { label: string; hint: string }) {
  return (
    <Tooltip label={hint}>
      <span className="cursor-help border-b border-dotted border-court-300 dark:border-court-600">
        {label}
      </span>
    </Tooltip>
  )
}
