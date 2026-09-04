import { useTranslation } from 'react-i18next'
import type { StandingRow } from '../../engine/standings'
import type { PlayerId } from '../../engine/types'
import { Ltr } from '../common/ui'

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
      <div className="border-b border-court-100 px-4 py-2.5 font-semibold dark:border-court-800">
        {title}
      </div>
      <table className="w-full text-sm">
        <thead className="text-court-500 dark:text-court-200">
          <tr>
            <th className="px-2 py-2 text-center font-medium">{t('table.rank')}</th>
            <th className="px-2 py-2 text-start font-medium">{t('table.player')}</th>
            <th className="px-2 py-2 text-center font-medium">{t('table.played')}</th>
            <th className="px-2 py-2 text-center font-medium">{t('table.won')}</th>
            <th className="px-2 py-2 text-center font-medium">{t('table.games')}</th>
            <th className="px-2 py-2 text-center font-medium">{t('table.points')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const qualifies = advancing > 0 && row.rank <= advancing
            return (
              <tr
                key={row.playerId}
                className={`border-t border-court-50 dark:border-court-800 ${
                  qualifies ? 'bg-court-500/8' : ''
                }`}
              >
                <td className="relative px-2 py-2.5 text-center tabular-nums">
                  {qualifies ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 start-0 w-1 bg-court-500"
                    />
                  ) : null}
                  {row.rank}
                </td>
                <td className="px-2 py-2.5">
                  <span className="font-medium">{nameOf(row.playerId)}</span>
                  {row.tiebreakReason ? (
                    <span
                      className="ms-1.5 text-xs text-court-500 dark:text-court-300"
                      title={t(`tiebreak.${row.tiebreakReason}`)}
                    >
                      ⓘ
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums">{row.played}</td>
                <td className="px-2 py-2.5 text-center tabular-nums">{row.won}</td>
                <td className="px-2 py-2.5 text-center">
                  <Ltr>
                    {row.gamesFor}:{row.gamesAgainst}
                  </Ltr>
                </td>
                <td className="px-2 py-2.5 text-center font-semibold tabular-nums">
                  {row.matchPoints}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
