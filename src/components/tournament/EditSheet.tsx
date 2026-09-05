import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  BestOf,
  FormatConfig,
  Level,
  LevelId,
  PlayerId,
  ScoreMode,
  Tournament,
} from '../../engine/types'
import { buildFixtures } from '../../engine/resolve'
import { generateSeed } from '../../engine/rng'
import { suggestedConfig } from '../../engine/advisor'
import { newId, useAppStore } from '../../store/useAppStore'
import { levelDefaultName } from '../../i18n/levelName'
import { Button, Chip, Field, inputClass, Ltr } from '../common/ui'
import { Sheet } from '../common/Sheet'
import { navigate } from '../../router'
import { Tooltip } from '../common/Tooltip'
import { toast } from '../../store/useToasts'
import { DrawEditor } from './DrawEditor'
import { FormatPicker } from '../wizard/FormatPicker'

/**
 * Edit a tournament while it is running.
 *
 * Two things are guarded rather than freely editable: re-drawing, which throws away
 * the level's results, and removing a player who has already played. Everything else
 * — names, dates, match length, scoring mode, table count, the format, adding a level,
 * adding a late entrant, moving someone into the level next door — is safe to change
 * at any point because the engine re-derives from source each time.
 */
export function EditSheet({
  open,
  onClose,
  tournament,
  level,
  playedCount,
  onSelectLevel,
}: {
  open: boolean
  onClose: () => void
  tournament: Tournament
  level: Level
  /** Matches already recorded in this level; gates the destructive actions. */
  playedCount: number
  /** Switch the page — and this sheet with it — to another level. */
  onSelectLevel: (index: number) => void
}) {
  const { t } = useTranslation()
  const roster = useAppStore((s) => s.roster)
  const patchTournament = useAppStore((s) => s.patchTournament)
  const patchLevel = useAppStore((s) => s.patchLevel)
  const setLevelConfig = useAppStore((s) => s.setLevelConfig)
  const addLevel = useAppStore((s) => s.addLevel)
  const removeLevel = useAppStore((s) => s.removeLevel)
  const restoreLevel = useAppStore((s) => s.restoreLevel)
  const movePlayer = useAppStore((s) => s.movePlayer)
  const redrawLevel = useAppStore((s) => s.redrawLevel)
  const toggleWithdrawn = useAppStore((s) => s.toggleWithdrawn)
  const addRosterPlayer = useAppStore((s) => s.addRosterPlayer)
  const removeTournament = useAppStore((s) => s.removeTournament)
  const restoreTournament = useAppStore((s) => s.restoreTournament)

  const [newName, setNewName] = useState('')
  const [confirmRedraw, setConfirmRedraw] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [manualDraw, setManualDraw] = useState(false)
  const [showFormat, setShowFormat] = useState(false)
  /** The player whose target-level chips are open, if any. */
  const [moving, setMoving] = useState<PlayerId | null>(null)

  const nameOf = (id: PlayerId) =>
    tournament.players.find((p) => p.id === id)?.name ?? id

  /**
   * Results recorded in each level.
   *
   * A move takes a player *out* of one level and into another, and only the leaving
   * half is guarded — so it needs the count for the level being left, which is not
   * always the level being edited.
   */
  const playedIn = useMemo(() => {
    const counts = new Map<LevelId, number>()
    for (const l of tournament.levels) {
      const ids = new Set(buildFixtures(l).matches.map((m) => m.id))
      counts.set(l.id, Object.keys(tournament.results).filter((id) => ids.has(id)).length)
    }
    return counts
  }, [tournament])

  /** The level holding each player who is not in the level being edited. */
  const heldBy = new Map<PlayerId, Level>()
  for (const l of tournament.levels) {
    if (l.id === level.id) continue
    for (const id of l.playerIds) heldBy.set(id, l)
  }

  const addable = roster.filter((p) => !level.playerIds.includes(p.id))
  const others = tournament.levels.filter((l) => l.id !== level.id)
  /**
   * Every result stored against this level, stale ones included.
   *
   * `playedCount` counts only the results that still belong to the players standing
   * in their match, so a level holding nothing but flagged results reads as unplayed
   * — fine for the guards that only reshape a draw, wrong for the one that deletes.
   */
  const storedHere = playedIn.get(level.id) ?? 0
  const recommended = suggestedConfig(level.playerIds.length)
  const suggestFormat = playedCount === 0 && recommended.format !== level.config.format

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

  /** Take a player out of the level holding them and into this one. */
  const takePlayer = async (id: PlayerId, from: Level) => {
    setMoving(null)
    await movePlayer(id, from.id, level.id)
    toast(t('edit.moved', { name: nameOf(id), level: level.name }))
  }

  const sendPlayer = async (id: PlayerId, to: Level) => {
    setMoving(null)
    await movePlayer(id, level.id, to.id)
    toast(t('edit.moved', { name: nameOf(id), level: to.name }))
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
    if (!player) return
    // A name already on the roster comes back as the player it names, so typing
    // someone who is in another level moves them here rather than cloning them.
    const holder = heldBy.get(player.id)
    if (holder) await takePlayer(player.id, holder)
    else if (!level.playerIds.includes(player.id)) await addPlayer(player.id, player.name)
  }

  const createLevel = async () => {
    const index = tournament.levels.length
    const created: Level = {
      id: newId(),
      name: levelDefaultName(index, t),
      playerIds: [],
      config: suggestedConfig(0),
      // The match length already chosen for tonight, not a fresh default.
      bestOf: level.bestOf,
      seed: generateSeed(),
      withdrawn: [],
    }
    await addLevel(created)
    onSelectLevel(index)
    toast(t('edit.levelAdded', { name: created.name }))
  }

  const dropLevel = async () => {
    const removed = level
    const index = tournament.levels.findIndex((l) => l.id === removed.id)
    onSelectLevel(0)
    await removeLevel(removed.id)
    toast(t('edit.levelRemoved', { name: removed.name }), 'warn', {
      label: t('feedback.undo'),
      run: () => {
        void restoreLevel(removed, index)
        toast(t('edit.levelRestored', { name: removed.name }))
      },
    })
  }

  const changeFormat = async (config: FormatConfig) => {
    await setLevelConfig(level.id, config)
    toast(t('edit.formatChanged'), playedCount > 0 ? 'warn' : 'success')
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

        {/* Which level everything below is about. A tournament can grow one
            mid-evening — a second division turns up, or the field splits — and the
            new level is empty until players are moved into it. */}
        <div>
          <span className="mb-2 block font-medium text-court-700 dark:text-court-200">
            {t('edit.levels')}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {tournament.levels.map((l, i) => (
              <Tooltip
                key={l.id}
                label={t('wizard.levelTab', { name: l.name, count: l.playerIds.length })}
              >
                <Chip selected={l.id === level.id} onClick={() => onSelectLevel(i)}>
                  {l.name} · {l.playerIds.length}
                </Chip>
              </Tooltip>
            ))}
            <Tooltip label={t('wizard.addLevelHint')}>
              <Button variant="subtle" size="sm" onClick={() => void createLevel()}>
                + {t('wizard.addLevel')}
              </Button>
            </Tooltip>
            {tournament.levels.length > 1 ? (
              <Tooltip
                label={storedHere > 0 ? t('edit.removeLevelBlocked') : t('wizard.removeLevelHint')}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={storedHere > 0}
                  onClick={() => void dropLevel()}
                >
                  ✕
                </Button>
              </Tooltip>
            ) : null}
          </div>
        </div>

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
                <li key={id} className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`flex-1 ${out ? 'text-court-400 line-through' : ''}`}>
                      {nameOf(id)}
                    </span>
                    {others.length > 0 ? (
                      <Tooltip
                        label={
                          playedCount > 0
                            ? t('edit.moveBlocked')
                            : t('edit.moveHint', { name: nameOf(id) })
                        }
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={playedCount > 0}
                          aria-pressed={moving === id}
                          onClick={() => setMoving(moving === id ? null : id)}
                        >
                          ⇄
                        </Button>
                      </Tooltip>
                    ) : null}
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
                  </div>

                  {moving === id ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-court-600 dark:text-court-200">
                        {t('edit.moveTo')}
                      </span>
                      {others.map((target) => (
                        <Chip
                          key={target.id}
                          className="text-sm"
                          onClick={() => void sendPlayer(id, target)}
                        >
                          {target.name}
                        </Chip>
                      ))}
                    </div>
                  ) : null}
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

          {/* Saved players, including the ones another level is holding: tapping one
              of those moves them here rather than entering them twice. */}
          {addable.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {addable.map((player) => {
                const holder = heldBy.get(player.id)
                const blocked = holder ? (playedIn.get(holder.id) ?? 0) > 0 : false
                return (
                  <Tooltip
                    key={player.id}
                    label={
                      holder
                        ? blocked
                          ? t('edit.moveBlocked')
                          : t('roster.tapToMove', { level: holder.name })
                        : t('roster.tapToAdd')
                    }
                  >
                    <Chip
                      className={`text-sm ${holder ? 'opacity-70' : ''}`}
                      disabled={blocked}
                      onClick={() =>
                        holder
                          ? void takePlayer(player.id, holder)
                          : void addPlayer(player.id, player.name)
                      }
                    >
                      + {player.name}
                      {holder ? (
                        <span className="ms-1.5 text-xs font-normal text-court-500 dark:text-court-300">
                          {t('roster.inLevel', { level: holder.name })}
                        </span>
                      ) : null}
                    </Chip>
                  </Tooltip>
                )
              })}
            </div>
          ) : null}
        </div>

        {/* The format is what decides whether a level draws groups or a bracket, so a
            level added mid-evening — or one drawn before half the field arrived — can
            be put right here rather than only in the wizard. */}
        <div className="space-y-3 border-t border-court-100 pt-4 dark:border-court-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-court-700 dark:text-court-200">
              {t('wizard.formatStep')}
            </span>
            <span className="text-sm text-court-500 dark:text-court-300">
              {t('edit.formatCurrent', { format: t(`format.${level.config.format}`) })}
            </span>
            <div className="flex-1" />
            <Tooltip label={t('edit.formatHint')}>
              <Button
                variant={showFormat ? 'primary' : 'subtle'}
                size="sm"
                aria-pressed={showFormat}
                onClick={() => setShowFormat(!showFormat)}
              >
                {t('edit.formatChange')}
              </Button>
            </Tooltip>
          </div>

          {/* Nothing has been played here yet and the field has outgrown its format —
              the case where a level added mid-evening is still the round robin it was
              born as while its 16 players are waiting for groups. */}
          {suggestFormat ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-ball-500/10 p-3">
              <span className="text-sm text-court-700 dark:text-court-100">
                ★{' '}
                {t('edit.formatSuggest', {
                  count: level.playerIds.length,
                  format: t(`format.${recommended.format}`),
                })}
              </span>
              <div className="flex-1" />
              <Button variant="subtle" size="sm" onClick={() => void changeFormat(recommended)}>
                {t('edit.formatApply')}
              </Button>
            </div>
          ) : null}

          {showFormat ? (
            <>
              {playedCount > 0 ? (
                <p className="text-sm font-medium text-ball-600">{t('edit.formatWarnResults')}</p>
              ) : null}
              <FormatPicker
                value={level.config}
                playerCount={level.playerIds.length}
                bestOf={level.bestOf}
                tableCount={tournament.tableCount}
                recommended={recommended.format}
                onChange={(config) => void changeFormat(config)}
              />
            </>
          ) : null}
        </div>

        {/* The draw itself: reshuffle it, take it apart by hand, or read off the
            seed that reproduces it — all one subject, so they sit together. */}
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

          <div className="rounded-xl bg-court-50 p-3 text-court-600 dark:bg-court-800/60 dark:text-court-200">
            <div className="flex flex-wrap items-center gap-2">
              <span aria-hidden="true">🎲</span>
              <span className="font-medium">{t('run.seedLabel')}</span>
              <span className="text-lg font-bold text-court-900 dark:text-court-50">
                <Ltr>{level.seed}</Ltr>
              </span>
            </div>
            <p className="mt-1 text-sm">
              {level.manualOrder ? t('run.seedManual') : t('run.seedHint')}
            </p>
          </div>
        </div>

        {/* Deleting is the one edit that cannot re-derive itself, so it sits last,
            behind a confirm, and hands back an undo that writes the record it just
            captured — nothing about the tournament is read from the store again. */}
        <div className="space-y-3 border-t border-court-100 pt-4 dark:border-court-800">
          <span className="block font-medium text-court-700 dark:text-court-200">
            {t('edit.deleteSection')}
          </span>

          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-ball-600">
                {t('edit.deleteWarn', { name: tournament.name })}
              </span>
              <div className="flex-1" />
              <Button variant="subtle" size="sm" onClick={() => setConfirmDelete(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  const deleted = tournament
                  setConfirmDelete(false)
                  onClose()
                  void removeTournament(deleted.id)
                  navigate({ name: 'home' })
                  toast(t('edit.deleteDone', { name: deleted.name }), 'warn', {
                    label: t('feedback.undo'),
                    run: () => {
                      void restoreTournament(deleted)
                      toast(t('edit.deleteUndone', { name: deleted.name }))
                    },
                  })
                }}
              >
                🗑 {t('edit.delete')}
              </Button>
            </div>
          ) : (
            <Tooltip label={t('edit.deleteHint')}>
              <Button variant="subtle" size="sm" onClick={() => setConfirmDelete(true)}>
                🗑 {t('edit.delete')}
              </Button>
            </Tooltip>
          )}
        </div>

        <Button className="w-full" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </Sheet>
  )
}
