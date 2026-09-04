import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import type { StandingRow } from '../../engine/standings'
import type { PlayerId } from '../../engine/types'
import { Ltr } from '../common/ui'
import { Tooltip } from '../common/Tooltip'

export function GroupTable({
  title,
  rows,
  nameOf,
  advancing = 0,
}: {
  title: string
  rows: StandingRow[]
  nameOf: (id: PlayerId) => string
  /** How many top rows qualify, drawn with a marker down the side. */
  advancing?: number
}) {
  const { t } = useTranslation()

  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-court-100 dark:bg-court-900 dark:ring-court-800">
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
              <th className="px-2 py-2.5 text-center font-medium">{t('table.rank')}</th>
              <th className="px-2 py-2.5 text-start font-medium">{t('table.player')}</th>
              <th className="hidden px-2 py-2.5 text-center font-medium sm:table-cell">
                {t('table.played')}
              </th>
              <th className="px-2 py-2.5 text-center font-medium">{t('table.won')}</th>
              <th className="px-2 py-2.5 text-center font-medium">{t('table.games')}</th>
              <th className="px-2 py-2.5 text-center font-medium">{t('table.points')}</th>
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
                    <Ltr>
                      {row.gamesFor}:{row.gamesAgainst}
                    </Ltr>
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
    </div>
  )
}
