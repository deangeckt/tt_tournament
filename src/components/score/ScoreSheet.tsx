import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import type { BestOf, GameScore, MatchResult, ScoreMode } from '../../engine/types'
import { gamesToWin, validateGame } from '../../engine/result'
import { Button, Score } from '../common/ui'

interface Props {
  open: boolean
  nameA: string
  nameB: string
  bestOf: BestOf
  scoreMode: ScoreMode
  existing?: MatchResult
  onSave: (result: MatchResult) => void
  onClear: () => void
  onClose: () => void
}

/** Every scoreline that can end a best-of-N, ordered by margin. */
function scorelines(bestOf: BestOf): Array<[number, number]> {
  const target = gamesToWin(bestOf)
  return Array.from({ length: target }, (_, i) => [target, i] as [number, number])
}

export function ScoreSheet(props: Props) {
  return (
    <AnimatePresence>
      {props.open ? (
        <>
          <motion.div
            className="fixed inset-0 z-30 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={props.onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg rounded-t-3xl bg-white p-5 pb-8 shadow-2xl dark:bg-court-900"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-court-200 dark:bg-court-700" />
            <SheetBody {...props} />
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

function SheetBody({ nameA, nameB, bestOf, scoreMode, existing, onSave, onClear, onClose }: Props) {
  const { t } = useTranslation()
  const target = gamesToWin(bestOf)

  const [games, setGames] = useState<GameScore[]>(() =>
    existing && (existing.kind === 'detailed' || existing.kind === 'retired')
      ? existing.games
      : [{ a: 0, b: 0 }],
  )

  const wonA = games.filter((g) => g.a > g.b).length
  const wonB = games.filter((g) => g.b > g.a).length
  const detailedDone = wonA === target || wonB === target

  const setGame = (index: number, patch: Partial<GameScore>) =>
    setGames((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)))

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-lg font-semibold">{nameA}</span>
        <span className="shrink-0 text-court-400">–</span>
        <span className="min-w-0 flex-1 truncate text-end text-lg font-semibold">{nameB}</span>
      </div>

      {scoreMode === 'quick' ? (
        <div className="space-y-2">
          {scorelines(bestOf).map(([win, lose]) => (
            <div key={lose} className="grid grid-cols-2 gap-2">
              <Button variant="subtle" onClick={() => onSave({ kind: 'quick', a: win, b: lose })}>
                <Score a={win} b={lose} />
              </Button>
              <Button variant="subtle" onClick={() => onSave({ kind: 'quick', a: lose, b: win })}>
                <Score a={lose} b={win} />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {games.map((game, i) => {
            const problem = validateGame(game)
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-sm text-court-500 tabular-nums">{i + 1}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={game.a || ''}
                  onChange={(e) => setGame(i, { a: Number(e.target.value) || 0 })}
                  className="w-full rounded-xl bg-court-100 px-3 py-2 text-center text-lg tabular-nums dark:bg-court-800"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={game.b || ''}
                  onChange={(e) => setGame(i, { b: Number(e.target.value) || 0 })}
                  className="w-full rounded-xl bg-court-100 px-3 py-2 text-center text-lg tabular-nums dark:bg-court-800"
                />
                <span
                  className={`w-4 shrink-0 text-sm ${problem ? 'text-ball-600' : 'text-transparent'}`}
                  title={problem ?? ''}
                >
                  !
                </span>
              </div>
            )
          })}
          {!detailedDone && games.length < bestOf ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setGames((prev) => [...prev, { a: 0, b: 0 }])}
            >
              +
            </Button>
          ) : null}
          <Button
            className="w-full"
            disabled={!detailedDone}
            onClick={() => onSave({ kind: 'detailed', games })}
          >
            {t('common.save')} <Score a={wonA} b={wonB} />
          </Button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-court-100 pt-4 dark:border-court-800">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSave({ kind: 'walkover', winner: 'a' })}
          title={nameA}
        >
          {t('match.walkover')} ←
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSave({ kind: 'walkover', winner: 'b' })}
          title={nameB}
        >
          → {t('match.walkover')}
        </Button>
        <div className="flex-1" />
        {existing ? (
          <Button variant="ghost" size="sm" onClick={onClear}>
            {t('common.delete')}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </>
  )
}
