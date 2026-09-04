import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { Button, Chip, inputClass } from '../common/ui'
import { Tooltip } from '../common/Tooltip'
import type { PlayerId } from '../../engine/types'

/**
 * Pick players for a level from the saved roster, or type new ones.
 *
 * A newly typed name is added to the roster immediately, which is the whole point of
 * keeping one: next week the manager taps instead of types.
 */
export function PlayerPicker({
  selected,
  taken,
  onChange,
  onAdd,
}: {
  selected: PlayerId[]
  /** Ids already used by another level — a player belongs to one level only. */
  taken: Set<PlayerId>
  onChange: (ids: PlayerId[]) => void
  /** Appends one player. Separate from onChange so several fast adds cannot
   *  overwrite each other through a stale `selected` array. */
  onAdd: (id: PlayerId) => void
}) {
  const { t } = useTranslation()
  const roster = useAppStore((s) => s.roster)
  const addRosterPlayer = useAppStore((s) => s.addRosterPlayer)
  const [name, setName] = useState('')

  const chosen = new Set(selected)

  const toggle = (id: PlayerId) => {
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const pending = name.trim()
    if (!pending) return
    // Clear before awaiting the write: otherwise a fast typist's next keystrokes
    // land in a field that still holds the name just submitted.
    setName('')
    const player = await addRosterPlayer(pending)
    if (player) onAdd(player.id)
  }

  const available = roster.filter((p) => !taken.has(p.id) || chosen.has(p.id))

  return (
    <div>
      <form onSubmit={submit} className="mb-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('roster.addPlaceholder')}
          className={inputClass}
          autoComplete="off"
        />
        <Button type="submit" size="sm" disabled={!name.trim()}>
          {t('common.add')}
        </Button>
      </form>

      <div className="mb-2 flex items-center gap-3 text-sm text-court-600 dark:text-court-200">
        <span>{t('roster.selected', { count: selected.length })}</span>
        <div className="flex-1" />
        {available.length > 0 ? (
          <button
            type="button"
            className="rounded-lg px-2 py-1 underline underline-offset-2 transition hover:bg-court-100 dark:hover:bg-court-800"
            onClick={() => onChange(available.map((p) => p.id))}
          >
            {t('roster.addAll')}
          </button>
        ) : null}
        {selected.length > 0 ? (
          <button type="button" className="rounded-lg px-2 py-1 underline underline-offset-2 transition hover:bg-court-100 dark:hover:bg-court-800" onClick={() => onChange([])}>
            {t('roster.clearSelection')}
          </button>
        ) : null}
      </div>

      {available.length === 0 ? (
        <p className="rounded-xl bg-court-100 px-3 py-4 text-center text-sm text-court-600 dark:bg-court-800 dark:text-court-200">
          {t('roster.empty')}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {available.map((player) => {
            const on = chosen.has(player.id)
            return (
              <Tooltip key={player.id} label={on ? t('roster.tapToRemove') : t('roster.tapToAdd')}>
                <Chip selected={on} onClick={() => toggle(player.id)} className="!rounded-full">
                  {on ? '✓ ' : ''}
                  {player.name}
                </Chip>
              </Tooltip>
            )
          })}
        </div>
      )}
    </div>
  )
}
