import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Level, PlayerId, Tournament } from '../../engine/types'
import { buildFixtures, drawPlacements } from '../../engine/resolve'
import { useAppStore } from '../../store/useAppStore'
import { Button } from '../common/ui'
import { Tooltip } from '../common/Tooltip'
import { toast } from '../../store/useToasts'

/**
 * Rearrange a draw by hand.
 *
 * Nothing structural is written: the editor only ever reorders the *draw order*, the
 * single list every fixture already derives from. Swapping two names therefore moves
 * them through groups, seeds and bracket positions exactly as a different shuffle
 * would have, with no second code path for hand-made draws.
 *
 * Tap-to-pick then tap-to-place, rather than drag: it has to work with a thumb on a
 * phone held over a table, and drag-and-drop inside a scrolling bottom sheet is a
 * fight even on a desktop.
 */
export function DrawEditor({
  tournament,
  level,
  playedCount,
}: {
  tournament: Tournament
  level: Level
  playedCount: number
}) {
  const { t } = useTranslation()
  const setDrawOrder = useAppStore((s) => s.setDrawOrder)
  const clearDrawOrder = useAppStore((s) => s.clearDrawOrder)
  const [picked, setPicked] = useState<PlayerId | null>(null)

  const nameOf = (id: PlayerId) => tournament.players.find((p) => p.id === id)?.name ?? id

  const { order, blocks } = useMemo(() => {
    const placements = drawPlacements(level)
    const { groups, matches } = buildFixtures(level)
    const drawn = placements.map((p) => p.playerId)

    // Group stage if there is one, otherwise the opening round of the bracket:
    // either way the manager sees who a move actually puts someone up against.
    if (groups.length > 0) {
      return {
        order: drawn,
        blocks: groups.map((group) => ({
          key: group.id,
          label: t('draw.inGroup', { group: group.name }),
          playerIds: group.playerIds,
        })),
      }
    }

    const firstRound = matches
      .filter((m) => m.stage !== 'group' && m.round === 0)
      .sort((a, b) => a.order - b.order)

    return {
      order: drawn,
      blocks: firstRound.map((match) => ({
        key: match.id,
        label: t('draw.firstMatch', { n: match.order + 1 }),
        playerIds: [match.a, match.b].flatMap((slot) =>
          slot.kind === 'player' ? [slot.playerId] : [],
        ),
      })),
    }
  }, [level, t])

  const swap = async (playerId: PlayerId) => {
    if (!picked) {
      setPicked(playerId)
      toast(t('draw.picked', { name: nameOf(playerId) }), 'info')
      return
    }
    if (picked === playerId) {
      setPicked(null)
      return
    }

    const next = order.slice()
    const from = next.indexOf(picked)
    const to = next.indexOf(playerId)
    if (from < 0 || to < 0) {
      setPicked(null)
      return
    }
    ;[next[from], next[to]] = [next[to], next[from]]

    setPicked(null)
    await setDrawOrder(level.id, next)
    toast(t('draw.swapped', { a: nameOf(picked), b: nameOf(playerId) }))
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-court-600 dark:text-court-200">{t('draw.pickHint')}</p>

      {playedCount > 0 ? (
        <p className="rounded-xl bg-ball-500/12 px-3 py-2 text-sm text-ball-600">
          {t('draw.resultsWarn')}
        </p>
      ) : null}

      <div className="space-y-3">
        {blocks.map((block) => (
          <div key={block.key}>
            <div className="mb-1.5 text-sm font-medium text-court-500 dark:text-court-300">
              {block.label}
            </div>
            <div className="flex flex-wrap gap-2">
              {block.playerIds.map((id) => {
                const on = picked === id
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => void swap(id)}
                    className={`min-h-11 rounded-xl px-3.5 py-2 font-medium transition-all duration-150
                      active:scale-[0.97] ${
                        on
                          ? 'bg-ball-500 text-court-950 shadow-md ring-2 ring-ball-600'
                          : 'bg-white text-court-800 ring-1 ring-court-200 hover:bg-court-50 hover:ring-court-400 dark:bg-court-900 dark:text-court-100 dark:ring-court-700 dark:hover:bg-court-800'
                      } ${level.withdrawn.includes(id) ? 'line-through opacity-60' : ''}`}
                  >
                    {nameOf(id)}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {level.manualOrder ? (
        <Tooltip label={t('draw.resetHint')}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void clearDrawOrder(level.id)
              setPicked(null)
              toast(t('draw.resetDone'), 'warn')
            }}
          >
            ↩ {t('draw.reset')}
          </Button>
        </Tooltip>
      ) : null}
    </div>
  )
}
