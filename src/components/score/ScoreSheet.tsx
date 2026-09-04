import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BestOf, GameScore, MatchResult, ScoreMode } from '../../engine/types'
import { gamesToWin, validateGame } from '../../engine/result'
import { Button, Score } from '../common/ui'
import { Sheet } from '../common/Sheet'

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

export function ScoreSheet({ matchKey, ...props }: Props & { matchKey?: string }) {
  return (
    <Sheet open={props.open} onClose={props.onClose}>
      {/* Keyed by match, so pointing the sheet at a different match remounts the body
          and its state starts fresh — no effect needed to clear half-entered games. */}
      <SheetBody key={matchKey} {...props} />
    </Sheet>
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
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-lg font-bold">{nameA}</span>
        <span className="shrink-0 text-court-400">–</span>
        <span className="min-w-0 flex-1 truncate text-end text-lg font-bold">{nameB}</span>
      </div>

      {scoreMode === 'quick' ? (
        <div className="space-y-2">
          {scorelines(bestOf).map(([win, lose]) => (
            <div key={lose} className="grid grid-cols-2 gap-2">
              <Button
                variant="subtle"
                className="text-lg"
                onClick={() => onSave({ kind: 'quick', a: win, b: lose })}
              >
                <Score a={win} b={lose} />
              </Button>
              <Button
                variant="subtle"
                className="text-lg"
                onClick={() => onSave({ kind: 'quick', a: lose, b: win })}
              >
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
                  className="w-full rounded-xl bg-court-100 px-3 py-3 text-center text-xl tabular-nums focus:ring-2 focus:ring-court-500 focus:outline-none dark:bg-court-800"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={game.b || ''}
                  onChange={(e) => setGame(i, { b: Number(e.target.value) || 0 })}
                  className="w-full rounded-xl bg-court-100 px-3 py-3 text-center text-xl tabular-nums focus:ring-2 focus:ring-court-500 focus:outline-none dark:bg-court-800"
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
              variant="subtle"
              size="sm"
              className="w-full"
              onClick={() => setGames((prev) => [...prev, { a: 0, b: 0 }])}
            >
              + {t('score.addGame')}
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

      <div className="mt-5 flex flex-wrap gap-2 border-t border-court-100 pt-4 dark:border-court-800">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSave({ kind: 'walkover', winner: 'a' })}
          title={`${t('match.walkover')}: ${nameA}`}
        >
          {t('match.walkover')} ←
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSave({ kind: 'walkover', winner: 'b' })}
          title={`${t('match.walkover')}: ${nameB}`}
        >
          → {t('match.walkover')}
        </Button>
        <div className="flex-1" />
        {existing ? (
          <Button variant="ghost" size="sm" onClick={onClear}>
            {t('common.delete')}
          </Button>
        ) : null}
        <Button variant="subtle" size="sm" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </>
  )
}
