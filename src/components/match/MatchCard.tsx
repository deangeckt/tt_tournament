import { useTranslation } from 'react-i18next'
import type { MatchView } from '../../engine/resolve'
import type { BestOf, Group, PlayerId } from '../../engine/types'
import { tally } from '../../engine/result'
import { Score } from '../common/ui'
import { participantLabel } from './labels'

export function MatchCard({
  view,
  nameOf,
  groups,
  bestOf,
  flashKey,
  onOpen,
}: {
  view: MatchView
  nameOf: (id: PlayerId) => string
  groups: readonly Group[]
  bestOf: BestOf
  /**
   * Bumped by the screen that just changed this match's score. Used as a React key
   * so the highlight overlay remounts and replays its CSS animation — the flash is
   * driven by the event that caused it rather than by watching for a changed prop.
   */
  flashKey?: number
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
      className={`relative w-full overflow-hidden rounded-xl px-4 py-3.5 text-start transition-all duration-150
        ${
          view.playable
            ? 'bg-white ring-1 ring-court-100 hover:-translate-y-px hover:bg-court-50 hover:ring-court-400 hover:shadow-md active:scale-[0.99] dark:bg-court-900 dark:ring-court-800 dark:hover:bg-court-800 dark:hover:ring-court-500'
            : 'bg-court-100/60 text-court-500 dark:bg-court-800/50 dark:text-court-300'
        } ${stale ? 'ring-2 ring-ball-500' : ''}`}
    >
      {flashKey ? (
        <span key={flashKey} aria-hidden="true" className="tt-flash absolute inset-0" />
      ) : null}
      <div className="relative flex items-center gap-3">
        <span className={`min-w-0 flex-1 truncate ${result?.winner === 'a' ? 'font-bold' : ''}`}>
          {labelA}
        </span>
        {result ? (
          <Score a={result.gamesA} b={result.gamesB} className="shrink-0 text-lg font-bold" />
        ) : (
          <span className="shrink-0 text-sm text-court-400">
            {view.playable ? t('match.enterScore') : ''}
          </span>
        )}
        <span
          className={`min-w-0 flex-1 truncate text-end ${result?.winner === 'b' ? 'font-bold' : ''}`}
        >
          {labelB}
        </span>
      </div>
      {stale ? <p className="mt-1.5 text-sm text-ball-600">{t('match.stale')}</p> : null}
      {view.result?.kind === 'detailed' ? (
        <p className="mt-1.5 text-sm text-court-500 dark:text-court-300">
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
