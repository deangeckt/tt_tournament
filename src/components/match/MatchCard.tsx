import { useTranslation } from 'react-i18next'
import type { MatchView } from '../../engine/resolve'
import type { BestOf, Group, PlayerId, ScoreMode } from '../../engine/types'
import { tally } from '../../engine/result'
import { Score } from '../common/ui'
import { participantLabel } from './labels'

export function MatchCard({
  view,
  nameOf,
  groups,
  bestOf,
  scoreMode,
  onOpen,
}: {
  view: MatchView
  nameOf: (id: PlayerId) => string
  groups: readonly Group[]
  bestOf: BestOf
  scoreMode: ScoreMode
  onOpen: (view: MatchView) => void
}) {
  const { t } = useTranslation()
  const labelA = participantLabel(view.a, nameOf, groups, t)
  const labelB = participantLabel(view.b, nameOf, groups, t)
  const result = view.result ? tally(view.result, bestOf) : undefined
  const stale = view.staleness !== 'fresh'

  return (
    <button
      type="button"
      disabled={!view.playable}
      onClick={() => onOpen(view)}
      className={`w-full rounded-xl px-3 py-2.5 text-start transition ${
        view.playable
          ? 'bg-white ring-1 ring-court-100 hover:ring-court-300 dark:bg-court-900 dark:ring-court-800'
          : 'bg-court-100/60 text-court-500 dark:bg-court-800/50 dark:text-court-300'
      } ${stale ? 'ring-2 ring-ball-500' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`min-w-0 flex-1 truncate ${
            result?.winner === 'a' ? 'font-semibold' : ''
          }`}
        >
          {labelA}
        </span>
        {result ? (
          <Score a={result.gamesA} b={result.gamesB} className="shrink-0 font-semibold" />
        ) : (
          <span className="shrink-0 text-xs text-court-400">
            {view.playable ? t('match.enterScore') : ''}
          </span>
        )}
        <span
          className={`min-w-0 flex-1 truncate text-end ${
            result?.winner === 'b' ? 'font-semibold' : ''
          }`}
        >
          {labelB}
        </span>
      </div>
      {stale ? <p className="mt-1 text-xs text-ball-600">{t('match.stale')}</p> : null}
      {scoreMode === 'detailed' && view.result?.kind === 'detailed' ? (
        <p className="mt-1 text-xs text-court-500 dark:text-court-300">
          {view.result.games.map((g, i) => (
            <span key={i} className="me-2">
              <Score a={g.a} b={g.b} />
            </span>
          ))}
        </p>
      ) : null}
    </button>
  )
}
