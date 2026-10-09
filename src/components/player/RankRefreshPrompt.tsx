import { useTranslation } from 'react-i18next'
import { useRankRefresh } from '../../store/useRankRefresh'
import { Sheet } from '../common/Sheet'
import { Button } from '../common/ui'
import { TttmMatchList } from './TttmMatchList'

/**
 * Where a rank refresh stops to ask: which of two namesakes is ours, or what to do
 * about a lookup that failed.
 *
 * Mounted once, in App, rather than on the settings screen that starts the run, so
 * the question finds the manager wherever they have gone while the list works
 * itself through.
 */
export function RankRefreshPrompt() {
  const { t } = useTranslation()
  const question = useRankRefresh((s) => s.question)
  const done = useRankRefresh((s) => s.done)
  const total = useRankRefresh((s) => s.total)
  const answer = useRankRefresh((s) => s.answer)

  // Dismissing the sheet skips this one player: the mildest of the answers, so a
  // stray tap on the scrim costs one rank rather than the whole run.
  const skip = () => answer({ kind: 'skip' })
  const name = question?.player.name ?? ''

  return (
    <Sheet
      open={question !== undefined}
      onClose={skip}
      title={
        question?.kind === 'choose'
          ? t('refresh.chooseTitle', { name })
          : t('refresh.failedTitle', { name })
      }
    >
      {question ? (
        <div className="space-y-4">
          <p className="text-sm text-court-500 dark:text-court-300">
            {t('refresh.step', { n: done + 1, total })}
          </p>

          {question.kind === 'choose' ? (
            <>
              <p className="leading-relaxed">
                {t(question.exact ? 'refresh.chooseExact' : 'refresh.chooseNear', { name })}
              </p>
              <TttmMatchList
                matches={question.candidates}
                onPick={(match) => answer({ kind: 'pick', match })}
              />
            </>
          ) : (
            <>
              <p className="rounded-xl bg-ball-500/12 px-3 py-2 text-ball-600">
                {t(`refresh.${question.reason}`)}
              </p>
              <Button onClick={() => answer({ kind: 'retry' })}>↻ {t('refresh.retry')}</Button>
            </>
          )}

          <div className="flex flex-wrap gap-2 border-t border-court-100 pt-4 dark:border-court-800">
            <Button variant="subtle" size="sm" onClick={skip}>
              {t('refresh.skip')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => answer({ kind: 'stop' })}>
              {t('refresh.stopAll')}
            </Button>
          </div>
        </div>
      ) : null}
    </Sheet>
  )
}
