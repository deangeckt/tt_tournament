import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BestOf, Level, PlayerId, ScoreMode, Tournament } from '../../engine/types'
import { useAppStore } from '../../store/useAppStore'
import { Button, Chip, Field, inputClass } from '../common/ui'
import { Sheet } from '../common/Sheet'
import { Tooltip } from '../common/Tooltip'
import { toast } from '../../store/useToasts'
import { DrawEditor } from './DrawEditor'

/**
 * Edit a tournament while it is running.
 *
 * Two things are guarded rather than freely editable: re-drawing, which throws away
 * the level's results, and removing a player who has already played. Everything else
 * — names, dates, match length, scoring mode, table count, adding a late entrant — is
 * safe to change at any point because the engine re-derives from source each time.
 */
export function EditSheet({
  open,
  onClose,
  tournament,
  level,
  playedCount,
}: {
  open: boolean
  onClose: () => void
  tournament: Tournament
  level: Level
  /** Matches already recorded in this level; gates the destructive actions. */
  playedCount: number
}) {
  const { t } = useTranslation()
  const roster = useAppStore((s) => s.roster)
  const patchTournament = useAppStore((s) => s.patchTournament)
  const patchLevel = useAppStore((s) => s.patchLevel)
  const redrawLevel = useAppStore((s) => s.redrawLevel)
  const toggleWithdrawn = useAppStore((s) => s.toggleWithdrawn)
  const addRosterPlayer = useAppStore((s) => s.addRosterPlayer)

  const [newName, setNewName] = useState('')
  const [confirmRedraw, setConfirmRedraw] = useState(false)
  const [manualDraw, setManualDraw] = useState(false)

  const nameOf = (id: PlayerId) =>
    tournament.players.find((p) => p.id === id)?.name ?? id

  const takenElsewhere = new Set(
    tournament.levels.flatMap((l) => (l.id === level.id ? [] : l.playerIds)),
  )
  const addable = roster.filter(
    (p) => !level.playerIds.includes(p.id) && !takenElsewhere.has(p.id),
  )

  const addPlayer = async (id: PlayerId, name: string) => {
    await patchTournament({
      // Name only — the roster keeps the photo, and a tournament that carries one
      // would no longer fit in a share link.
      players: tournament.players.some((p) => p.id === id)
        ? tournament.players
        : [...tournament.players, { id, name }],
    })
    await patchLevel(level.id, { playerIds: [...level.playerIds, id] })
    toast(t('edit.playerAdded', { name }))
  }

  const removePlayer = async (id: PlayerId) => {
    await patchLevel(level.id, {
      playerIds: level.playerIds.filter((p) => p !== id),
      withdrawn: level.withdrawn.filter((p) => p !== id),
    })
    toast(t('edit.playerRemoved', { name: nameOf(id) }), 'warn')
  }

  const submitNew = async (event: React.FormEvent) => {
    event.preventDefault()
    const pending = newName.trim()
    if (!pending) return
    setNewName('')
    const player = await addRosterPlayer(pending)
    if (player) await addPlayer(player.id, player.name)
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('edit.title')}>
      <div className="space-y-5">
        <Field label={t('wizard.nameLabel')}>
          <input
            value={tournament.name}
            onChange={(e) => void patchTournament({ name: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label={t('wizard.dateLabel')}>
          <input
            type="date"
            value={tournament.date}
            onChange={(e) => void patchTournament({ date: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label={t('edit.levelName')}>
          <input
            value={level.name}
            onChange={(e) => void patchLevel(level.id, { name: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label={t('wizard.bestOf')}>
          <div className="flex flex-wrap gap-2">
            {([3, 5, 7] as const).map((value: BestOf) => (
              <Chip
                key={value}
                selected={level.bestOf === value}
                onClick={() => {
                  void patchLevel(level.id, { bestOf: value })
                  toast(t('wizard.bestOfValue', { count: value }))
                }}
              >
                {t('wizard.bestOfValue', { count: value })}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label={t('wizard.scoreMode')}>
          <div className="flex flex-wrap gap-2">
            {(['quick', 'detailed'] as const).map((mode: ScoreMode) => (
              <Chip
                key={mode}
                selected={tournament.scoreMode === mode}
                onClick={() => {
                  void patchTournament({ scoreMode: mode })
                  toast(t(`wizard.scoreMode${mode === 'quick' ? 'Quick' : 'Detailed'}`))
                }}
              >
                {mode === 'quick' ? '⚡ ' : '🏓 '}
                {t(`wizard.scoreMode${mode === 'quick' ? 'Quick' : 'Detailed'}`)}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label={t('wizard.tables')}>
          <input
            type="number"
            min={1}
            max={40}
            value={tournament.tableCount}
            onChange={(e) =>
              void patchTournament({ tableCount: Math.max(1, Number(e.target.value) || 1) })
            }
            className={inputClass}
          />
        </Field>

        <div>
          <span className="mb-2 block font-medium text-court-700 dark:text-court-200">
            {t('edit.players')}
          </span>
          <ul className="mb-3 divide-y divide-court-100 overflow-hidden rounded-xl ring-1 ring-court-100 dark:divide-court-800 dark:ring-court-800">
            {level.playerIds.map((id) => {
              const out = level.withdrawn.includes(id)
              return (
                <li key={id} className="flex items-center gap-2 px-3 py-2.5">
                  <span className={`flex-1 ${out ? 'text-court-400 line-through' : ''}`}>
                    {nameOf(id)}
                  </span>
                  <Tooltip label={out ? t('edit.reinstateHint') : t('edit.withdrawHint')}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void toggleWithdrawn(level.id, id)
                        toast(
                          out
                            ? t('edit.reinstated', { name: nameOf(id) })
                            : t('edit.withdrew', { name: nameOf(id) }),
                          out ? 'success' : 'warn',
                        )
                      }}
                    >
                      {out ? '↩' : '⏻'}
                    </Button>
                  </Tooltip>
                  <Tooltip
                    label={playedCount > 0 ? t('edit.removeBlocked') : t('edit.removeHint')}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={playedCount > 0}
                      onClick={() => void removePlayer(id)}
                    >
                      ✕
                    </Button>
                  </Tooltip>
                </li>
              )
            })}
          </ul>

          <form onSubmit={submitNew} className="mb-3 flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('roster.addPlaceholder')}
              className={inputClass}
              autoComplete="off"
            />
            <Button type="submit" size="sm" disabled={!newName.trim()}>
              {t('common.add')}
            </Button>
          </form>

          {addable.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {addable.map((player) => (
                <Chip
                  key={player.id}
                  className="text-sm"
                  onClick={() => void addPlayer(player.id, player.name)}
                >
                  + {player.name}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>

        {/* The draw itself: reshuffle it, or take it apart by hand. The seed lives
            on the tournament page, where everyone can read it off the screen. */}
        <div className="space-y-3 border-t border-court-100 pt-4 dark:border-court-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-court-700 dark:text-court-200">
              {t('draw.section')}
            </span>
            {level.manualOrder ? (
              <span className="rounded-lg bg-ball-500/15 px-2 py-1 text-xs font-medium text-ball-600">
                {t('draw.manualBadge')}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Tooltip label={t('draw.manualHint')}>
              <Button
                variant={manualDraw ? 'primary' : 'subtle'}
                size="sm"
                aria-pressed={manualDraw}
                onClick={() => setManualDraw(!manualDraw)}
              >
                ✋ {t('draw.manual')}
              </Button>
            </Tooltip>
            {confirmRedraw ? null : (
              <Tooltip label={t('edit.redrawHint')}>
                <Button variant="subtle" size="sm" onClick={() => setConfirmRedraw(true)}>
                  🎲 {t('edit.redraw')}
                </Button>
              </Tooltip>
            )}
          </div>

          {confirmRedraw ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-ball-600">
                {playedCount > 0 ? t('edit.redrawWarnResults', { count: playedCount }) : t('edit.redrawWarn')}
              </span>
              <div className="flex-1" />
              <Button variant="subtle" size="sm" onClick={() => setConfirmRedraw(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  void redrawLevel(level.id)
                  setConfirmRedraw(false)
                  toast(t('edit.redrawDone'), 'warn')
                }}
              >
                {t('edit.redraw')}
              </Button>
            </div>
          ) : null}

          {manualDraw ? (
            <DrawEditor tournament={tournament} level={level} playedCount={playedCount} />
          ) : null}
        </div>

        <Button className="w-full" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </Sheet>
  )
}
