import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { useAppStore } from '../../store/useAppStore'
import { useRankRefresh } from '../../store/useRankRefresh'
import { toast } from '../../store/useToasts'
import { refreshCounts } from '../../i18n/counts'
import type { RefreshOutcome } from '../../tttm/refresh'
import { Button, Card, Ltr, chipOffClass } from '../common/ui'
import { PlayerSheet } from './PlayerSheet'

/** "+97.4" or "−12.0": how far a rank moved, signed so the direction is never inferred. */
function delta(outcome: RefreshOutcome): string {
  const moved = Math.round(((outcome.after ?? 0) - (outcome.before ?? 0)) * 10) / 10
  return `${moved > 0 ? '+' : moved < 0 ? '−' : ''}${Math.abs(moved).toFixed(1)}`
}

/**
 * Refresh every saved player's TTTM rank, from the settings screen.
 *
 * The card is the run's dashboard and nothing more — the run itself lives in
 * `useRankRefresh`, and its questions are asked by `RankRefreshPrompt` — so leaving
 * the screen mid-run loses nothing, and coming back shows how far it got.
 *
 * What it leaves behind is the part worth reading: who moved and by how much, and
 * who is still without a fresh rank. The second list is a set of doors to each
 * player's card, because a player TTTM does not know by the roster's spelling is
 * one search with another spelling, or one pasted link, away from being linked —
 * and once linked, the next refresh reads them by id and never asks again.
 */
export function RankRefreshCard() {
  const { t } = useTranslation()
  const roster = useAppStore((s) => s.roster)
  const status = useRankRefresh((s) => s.status)
  const total = useRankRefresh((s) => s.total)
  const done = useRankRefresh((s) => s.done)
  const current = useRankRefresh((s) => s.current)
  const waiting = useRankRefresh((s) => s.waiting)
  const outcomes = useRankRefresh((s) => s.outcomes)
  const start = useRankRefresh((s) => s.start)
  const stop = useRankRefresh((s) => s.stop)
  const dismiss = useRankRefresh((s) => s.dismiss)
  /** Held by id, so the card follows the edits made inside it. */
  const [openId, setOpenId] = useState<string | null>(null)
  const open = roster.find((p) => p.id === openId) ?? null

  const begin = () =>
    start((result, finished) => {
      const summary = refreshCounts(t, finished)
      if (result === 'done') toast(t('refresh.doneToast', { summary }))
      else toast(t('refresh.stoppedToast'), 'info')
    })

  const halt = () => {
    stop()
    toast(t('refresh.stoppedToast'), 'info')
  }

  const running = status === 'running'
  const finished = status === 'done' || status === 'stopped'
  const updated = outcomes.filter((o) => o.kind === 'updated')
  const missing = outcomes.filter((o) => o.kind === 'notFound' || o.kind === 'skipped')
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <>
      <Card className="mb-4 space-y-4">
        <div>
          <h2 className="text-lg font-bold">{t('refresh.title')}</h2>
          <p className="mt-1 text-court-600 dark:text-court-200">{t('refresh.hint')}</p>
        </div>

        {running ? (
          <div className="space-y-3">
            <div className="h-2 overflow-hidden rounded-full bg-court-100 dark:bg-court-800">
              <motion.div
                className="h-full rounded-full bg-court-500"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ type: 'spring', stiffness: 220, damping: 30 }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-sm text-court-600 dark:text-court-200">
                <span className="font-semibold tabular-nums">
                  {t('refresh.progress', { done, total })}
                </span>
                {current ? (
                  <>
                    {' · '}
                    {waiting ? t('refresh.waiting') : t('refresh.looking', { name: current })}
                  </>
                ) : null}
              </p>
              <Button variant="subtle" size="sm" onClick={halt}>
                ■ {t('refresh.stop')}
              </Button>
            </div>
          </div>
        ) : null}

        {finished ? (
          <div className="space-y-4">
            <div>
              <p className="font-semibold">
                {status === 'done'
                  ? t('refresh.finished')
                  : t('refresh.stoppedAfter', { done, total })}
              </p>
              {outcomes.length > 0 ? (
                <p className="mt-0.5 text-sm text-court-600 dark:text-court-200">
                  {refreshCounts(t, outcomes)}
                </p>
              ) : null}
            </div>

            {updated.length > 0 ? (
              <div>
                <h3 className="mb-1.5 text-sm font-semibold text-court-700 dark:text-court-200">
                  {t('refresh.updatedTitle')}
                </h3>
                <ul className="divide-y divide-court-100 overflow-hidden rounded-xl ring-1 ring-court-100 dark:divide-court-800 dark:ring-court-800">
                  {updated.map((outcome) => (
                    <li key={outcome.playerId} className="flex items-center gap-3 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate">{outcome.name}</span>
                      <span className="shrink-0 text-sm text-court-500 dark:text-court-300">
                        {outcome.before === undefined ? (
                          t('refresh.firstRank')
                        ) : (
                          <Ltr>{delta(outcome)}</Ltr>
                        )}
                      </span>
                      <span className="w-16 shrink-0 text-end font-bold tabular-nums">
                        <Ltr>{outcome.after}</Ltr>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {missing.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-court-700 dark:text-court-200">
                  {t('refresh.missingTitle')}
                </h3>
                <p className="mt-0.5 mb-2 text-sm text-court-500 dark:text-court-300">
                  {t('refresh.missingHint')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {missing.map((outcome) => (
                    <button
                      key={outcome.playerId}
                      type="button"
                      onClick={() => setOpenId(outcome.playerId)}
                      className={`${chipOffClass} inline-flex items-center gap-2`}
                    >
                      {outcome.name}
                      <span className="text-xs font-normal text-court-500 dark:text-court-300">
                        {t(
                          outcome.kind === 'notFound'
                            ? 'refresh.tagNotFound'
                            : 'refresh.tagSkipped',
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {running ? null : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button onClick={begin} disabled={roster.length === 0}>
                ↻ {finished ? t('refresh.again') : t('refresh.start')}
              </Button>
              {finished ? (
                <Button variant="ghost" onClick={dismiss}>
                  {t('refresh.dismiss')}
                </Button>
              ) : null}
            </div>
            {/* Said beside the button that does it, as the card's own lookup says it. */}
            <p className="text-sm text-court-500 dark:text-court-300">{t('refresh.relayNote')}</p>
          </div>
        )}
      </Card>
      <PlayerSheet player={open} onClose={() => setOpenId(null)} />
    </>
  )
}
