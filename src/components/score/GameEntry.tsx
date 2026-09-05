import { useTranslation } from 'react-i18next'
import type { BestOf, GameScore } from '../../engine/types'
import { isComplete, validateGame } from '../../engine/result'
import { Button } from '../common/ui'
import { Tooltip } from '../common/Tooltip'

/**
 * Point-by-point entry for one match.
 *
 * Lives apart from the score sheet because it is needed in two places that are not
 * the same screen: the sheet, where it is the tournament's entry mode, and the
 * tiebreak resolver, where it is a one-off for two or three matches that a quick
 * tournament never asked for. Sharing the component is what keeps the second one
 * from drifting into a subtly different set of validation rules.
 */
export function GameEntry({
  nameA,
  nameB,
  bestOf,
  games,
  onChange,
}: {
  nameA: string
  nameB: string
  bestOf: BestOf
  games: GameScore[]
  onChange: (games: GameScore[]) => void
}) {
  const { t } = useTranslation()
  const setGame = (index: number, patch: Partial<GameScore>) =>
    onChange(games.map((g, i) => (i === index ? { ...g, ...patch } : g)))

  return (
    <div className="space-y-2">
      {/* Each column is headed by the player it belongs to — the first under the
          first-named player, who in Hebrew is the one on the right. */}
      <div className="flex items-center gap-2 text-sm text-court-500 dark:text-court-300">
        <span className="w-6 shrink-0" />
        <span className="w-full truncate text-center">{nameA}</span>
        <span className="w-full truncate text-center">{nameB}</span>
        <span className="w-4 shrink-0" />
      </div>
      {games.map((game, i) => {
        const problem = validateGame(game)
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-sm text-court-500 tabular-nums">{i + 1}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              aria-label={`${nameA} — ${i + 1}`}
              value={game.a || ''}
              onChange={(e) => setGame(i, { a: Number(e.target.value) || 0 })}
              className="w-full rounded-xl bg-court-100 px-3 py-3 text-center text-xl tabular-nums focus:ring-2 focus:ring-court-500 focus:outline-none dark:bg-court-800"
            />
            <input
              type="number"
              inputMode="numeric"
              min={0}
              aria-label={`${nameB} — ${i + 1}`}
              value={game.b || ''}
              onChange={(e) => setGame(i, { b: Number(e.target.value) || 0 })}
              className="w-full rounded-xl bg-court-100 px-3 py-3 text-center text-xl tabular-nums focus:ring-2 focus:ring-court-500 focus:outline-none dark:bg-court-800"
            />
            <span className="w-4 shrink-0 text-sm">
              {problem ? (
                <Tooltip
                  label={problem === 'incomplete' ? t('score.gameIncomplete') : t('score.gameMargin')}
                >
                  <span className="text-ball-600">!</span>
                </Tooltip>
              ) : null}
            </span>
          </div>
        )
      })}
      {!isComplete({ kind: 'detailed', games }, bestOf) && games.length < bestOf ? (
        <Button
          variant="subtle"
          size="sm"
          className="w-full"
          onClick={() => onChange([...games, { a: 0, b: 0 }])}
        >
          + {t('score.addGame')}
        </Button>
      ) : null}
    </div>
  )
}
