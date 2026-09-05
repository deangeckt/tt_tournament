import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BestOf, GameScore, MatchId, MatchResult, PlayerId } from '../../engine/types'
import { Button, Score } from '../common/ui'
import { Sheet } from '../common/Sheet'
import { gamesWon, isComplete } from '../../engine/result'
import { GameEntry } from '../score/GameEntry'

/** One match between the tied players that was entered without its game scores. */
export interface TieMatch {
  id: MatchId
  nameA: string
  nameB: string
  playedBy: [PlayerId, PlayerId]
  /** The games recorded so far, quick entry's 3–1 among them. */
  recorded: { a: number; b: number }
}

export interface TieEntry {
  id: MatchId
  result: MatchResult
  playedBy: [PlayerId, PlayerId]
}

interface Props {
  open: boolean
  /** The players in the dead heat, already named. */
  names: string[]
  bestOf: BestOf
  matches: TieMatch[]
  onSave: (entries: TieEntry[]) => void
  onClose: () => void
}

/**
 * Give one tie its points, without moving the tournament to detailed entry.
 *
 * A club running quick entry finds out it needed game scores only when two players
 * finish level and the table says so — long after the matches were played. Sending
 * the manager to the settings to change how *every* score is typed in, for the sake
 * of two matches that are already over, is a large lever for a small job, and it
 * leaves the actual work (re-entering those matches) still to do. So the tie is
 * resolved where it is reported: the matches that block point ratio are listed here
 * with their scores, and standings re-derive the moment they are saved.
 */
export function TiebreakSheet({ open, onClose, ...props }: Props) {
  return (
    <Sheet open={open} onClose={onClose}>
      {/* Keyed by the tie, so aiming the sheet at a different one starts clean. */}
      <SheetBody key={props.matches.map((m) => m.id).join('|')} onClose={onClose} {...props} />
    </Sheet>
  )
}

function SheetBody({ names, bestOf, matches, onSave, onClose }: Omit<Props, 'open'>) {
  const { t } = useTranslation()
  const [games, setGames] = useState<Record<MatchId, GameScore[]>>(() =>
    Object.fromEntries(matches.map((m) => [m.id, [{ a: 0, b: 0 }]])),
  )

  const gamesFor = (id: MatchId) => games[id] ?? [{ a: 0, b: 0 }]
  const decided = (entered: GameScore[]) => isComplete({ kind: 'detailed', games: entered }, bestOf)
  const ready = matches.filter((m) => decided(gamesFor(m.id)))
  const playerList = names.join(', ')

  const save = () =>
    onSave(
      ready.map((m) => ({
        id: m.id,
        result: { kind: 'detailed', games: gamesFor(m.id) },
        playedBy: m.playedBy,
      })),
    )

  return (
    <>
      <h2 className="mb-2 text-xl font-bold">{t('tiebreak.sheetTitle')}</h2>
      <p className="mb-1 text-sm text-court-600 dark:text-court-200">
        {t('tiebreak.sheetIntro', { names: playerList })}
      </p>
      <p className="mb-5 text-sm text-court-500 dark:text-court-300">{t('tiebreak.sheetScope')}</p>

      <div className="space-y-4">
        {matches.map((m) => {
          const entered = gamesFor(m.id)
          const won = gamesWon(entered)
          const complete = decided(entered)
          return (
            <div
              key={m.id}
              className={`rounded-2xl p-4 ring-1 transition-colors ${
                complete
                  ? 'bg-court-500/8 ring-court-400'
                  : 'ring-court-100 dark:ring-court-800'
              }`}
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate font-medium">{m.nameA}</span>
                {/* The result already on record, so the game scores can be checked
                    against it before they are saved over it. */}
                <Score
                  a={complete ? won.a : m.recorded.a}
                  b={complete ? won.b : m.recorded.b}
                  className={`shrink-0 font-bold ${complete ? '' : 'text-court-400'}`}
                />
                <span className="min-w-0 flex-1 truncate text-end font-medium">{m.nameB}</span>
              </div>
              <GameEntry
                nameA={m.nameA}
                nameB={m.nameB}
                bestOf={bestOf}
                games={entered}
                onChange={(next) => setGames((prev) => ({ ...prev, [m.id]: next }))}
              />
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-sm text-court-500 dark:text-court-300">
        {ready.length === matches.length
          ? t('tiebreak.sheetComplete')
          : t('tiebreak.sheetRemaining', { done: ready.length, total: matches.length })}
      </p>

      <div className="mt-4 flex gap-2 border-t border-court-100 pt-4 dark:border-court-800">
        <Button className="flex-1" disabled={ready.length === 0} onClick={save}>
          {t('common.save')}
        </Button>
        <Button variant="subtle" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </>
  )
}
