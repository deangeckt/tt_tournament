import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BestOf, GameScore, MatchResult, ScoreMode } from '../../engine/types'
import { gamesToWin, gamesWon, isComplete } from '../../engine/result'
import { Button, Score } from '../common/ui'
import { Sheet } from '../common/Sheet'
import { GameEntry } from './GameEntry'

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

  const [games, setGames] = useState<GameScore[]>(() =>
    existing && (existing.kind === 'detailed' || existing.kind === 'retired')
      ? existing.games
      : [{ a: 0, b: 0 }],
  )

  const won = gamesWon(games)
  const detailedDone = isComplete({ kind: 'detailed', games }, bestOf)

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-lg font-bold">{nameA}</span>
        <span className="shrink-0 text-court-400">–</span>
        <span className="min-w-0 flex-1 truncate text-end text-lg font-bold">{nameB}</span>
      </div>

      {scoreMode === 'quick' ? (
        /* Each column sits under the player it belongs to — the first column under
           the first-named player, which in Hebrew is the one on the right — and
           carries their name, so which side a tap awards is never inferred from the
           position of a digit. */
        <div className="space-y-2">
          {scorelines(bestOf).map(([win, lose]) => (
            <div key={lose} className="grid grid-cols-2 gap-2">
              <WinButton
                name={nameA}
                a={win}
                b={lose}
                onClick={() => onSave({ kind: 'quick', a: win, b: lose })}
              />
              <WinButton
                name={nameB}
                a={lose}
                b={win}
                onClick={() => onSave({ kind: 'quick', a: lose, b: win })}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <GameEntry
            nameA={nameA}
            nameB={nameB}
            bestOf={bestOf}
            games={games}
            onChange={setGames}
          />
          <Button
            className="w-full"
            disabled={!detailedDone}
            onClick={() => onSave({ kind: 'detailed', games })}
          >
            {t('common.save')} <Score a={won.a} b={won.b} />
          </Button>
        </div>
      )}

      {/* Walkovers name their winner too, for the same reason: an arrow pointing
          "that way" means the opposite thing in the two languages this app runs in. */}
      <div className="mt-5 flex flex-wrap gap-2 border-t border-court-100 pt-4 dark:border-court-800">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSave({ kind: 'walkover', winner: 'a' })}
        >
          {t('score.walkoverFor', { name: nameA })}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSave({ kind: 'walkover', winner: 'b' })}
        >
          {t('score.walkoverFor', { name: nameB })}
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

/** One tap that records a finished match, labelled with who it hands the win to. */
function WinButton({
  name,
  a,
  b,
  onClick,
}: {
  name: string
  a: number
  b: number
  onClick: () => void
}) {
  const { t } = useTranslation()
  return (
    <Button variant="subtle" className="flex-col gap-0.5 py-2.5" onClick={onClick}>
      <Score a={a} b={b} className="text-xl font-bold" />
      <span className="max-w-full truncate text-xs font-normal text-court-600 dark:text-court-200">
        {t('score.winsBy', { name })}
      </span>
    </Button>
  )
}
