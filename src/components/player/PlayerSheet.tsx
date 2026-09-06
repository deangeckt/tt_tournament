import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Player } from '../../engine/types'
import { playerStats } from '../../engine/stats'
import { useAppStore } from '../../store/useAppStore'
import { readPhoto } from '../../store/photo'
import { Avatar, Button, Ltr, Stat, inputClass } from '../common/ui'
import { Sheet } from '../common/Sheet'
import { RankSection } from './RankSection'
import { Tooltip } from '../common/Tooltip'
import { toast } from '../../store/useToasts'
import { navigate } from '../../router'

/**
 * One player: their photo, their record and every tournament they have played.
 *
 * The record is not stored anywhere — it is recomputed from the tournaments
 * themselves each time this opens, so a score corrected last week is corrected here
 * too, and there is no second copy of the truth to drift.
 */
export function PlayerSheet({ player, onClose }: { player: Player | null; onClose: () => void }) {
  return (
    <Sheet open={player !== null} onClose={onClose} title={player?.name}>
      {/* Keyed by player, so pointing the sheet at somebody else remounts the body
          and the name field starts from *their* name. The sheet itself never
          unmounts, so state initialised on the first open would otherwise stick. */}
      {player ? <SheetBody key={player.id} player={player} onClose={onClose} /> : null}
    </Sheet>
  )
}

function SheetBody({ player, onClose }: { player: Player; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const tournaments = useAppStore((s) => s.tournaments)
  const patchRosterPlayer = useAppStore((s) => s.patchRosterPlayer)
  const removeRosterPlayer = useAppStore((s) => s.removeRosterPlayer)
  const fileInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(player.name)

  const stats = useMemo(() => playerStats(tournaments, player.id), [tournaments, player.id])
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
  const winRate = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return
    try {
      const photo = await readPhoto(file)
      await patchRosterPlayer(player.id, { photo })
      toast(t('player.photoSaved'))
    } catch {
      toast(t('player.photoFailed'), 'warn')
    }
  }

  const commitName = async () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === player.name) return
    await patchRosterPlayer(player.id, { name: trimmed })
    toast(t('player.renamed', { name: trimmed }))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar name={player.name} photo={player.photo} size="lg" />
        <div className="flex flex-1 flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void choosePhoto(e.target.files?.[0])
              // Cleared so choosing the same file twice still fires a change.
              e.target.value = ''
            }}
          />
          <Button variant="subtle" size="sm" onClick={() => fileInput.current?.click()}>
            📷 {player.photo ? t('player.photoChange') : t('player.photoAdd')}
          </Button>
          {player.photo ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void patchRosterPlayer(player.id, { photo: undefined })
                toast(t('player.photoRemoved'), 'warn')
              }}
            >
              {t('player.photoRemove')}
            </Button>
          ) : null}
        </div>
      </div>

      <label className="block">
        <span className="mb-2 block font-medium text-court-700 dark:text-court-200">
          {t('player.rename')}
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void commitName()}
          className={inputClass}
        />
      </label>

      <RankSection player={player} />

      <div>
        <h3 className="mb-2 font-bold">{t('player.record')}</h3>
        <div className="grid grid-cols-3 gap-2">
          <Stat label={t('player.tournaments')} value={stats.tournaments} />
          <Stat label={t('player.titles')} value={stats.titles} />
          <Stat label={t('player.matches')} value={stats.played} />
          <Stat label={t('player.won')} value={stats.won} />
          <Stat label={t('player.lost')} value={stats.lost} />
          <Stat label={t('player.winRate')} value={<Ltr>{winRate}%</Ltr>} />
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-bold">{t('player.history')}</h3>
        {stats.history.length === 0 ? (
          <p className="rounded-xl bg-court-100 px-3 py-4 text-center text-sm text-court-600 dark:bg-court-800 dark:text-court-200">
            {t('player.noHistory')}
          </p>
        ) : (
          <ul className="divide-y divide-court-100 overflow-hidden rounded-xl ring-1 ring-court-100 dark:divide-court-800 dark:ring-court-800">
            {stats.history.map((entry) => (
              <li key={`${entry.tournamentId}:${entry.levelId}`}>
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    navigate({ name: 'run', id: entry.tournamentId })
                  }}
                  className="flex w-full items-center gap-3 px-3 py-3 text-start transition hover:bg-court-50 dark:hover:bg-court-800"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{entry.tournamentName}</span>
                    <span className="block text-sm text-court-500 dark:text-court-300">
                      {dateFormat.format(new Date(entry.date))}
                      {/* A standing exists from the moment the draw is made, so a
                          placement is only worth showing once they have played. */}
                      {entry.champion
                        ? ` · 🏆 ${t('player.championHere')}`
                        : entry.rank && entry.played > 0
                          ? ` · ${t('player.placed', { n: entry.rank })}`
                          : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-court-600 tabular-nums dark:text-court-200">
                    <Ltr>
                      {entry.won}/{entry.played}
                    </Ltr>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2 border-t border-court-100 pt-4 dark:border-court-800">
        <Tooltip label={t('roster.removeHint', { name: player.name })}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onClose()
              void removeRosterPlayer(player.id)
              toast(t('edit.playerRemoved', { name: player.name }), 'warn')
            }}
          >
            🗑 {t('player.removeFromRoster')}
          </Button>
        </Tooltip>
        <div className="flex-1" />
        <Button onClick={onClose}>{t('common.close')}</Button>
      </div>
    </div>
  )
}
