import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { orderPlayers, usePlayerOrder } from '../../store/usePlayerOrder'
import { Button, Chip, Ltr, chipOffClass, chipOnClass, inputClass } from '../common/ui'
import { Tooltip } from '../common/Tooltip'
import { PlayerSheet } from '../player/PlayerSheet'
import { PlayerOrderToggle } from '../player/PlayerOrderToggle'
import type { PlayerId } from '../../engine/types'

/**
 * Pick players for a level from the saved roster, or type new ones.
 *
 * A newly typed name is added to the roster immediately, which is the whole point of
 * keeping one: next week the manager taps instead of types.
 *
 * Someone already picked for another level is shown rather than hidden, carrying the
 * name of the level holding them. Tapping moves them here — the same one tap as any
 * other player, because "he is in the wrong division" is the correction that actually
 * happens at the desk, and hiding him only sends the manager off to find him.
 */
export function PlayerPicker({
  selected,
  elsewhere,
  onChange,
  onAssign,
}: {
  selected: PlayerId[]
  /** Players another level holds, mapped to that level's name. */
  elsewhere: Map<PlayerId, string>
  onChange: (ids: PlayerId[]) => void
  /** Gives one player to this level, taking them out of any other. Separate from
   *  onChange so several fast adds cannot overwrite each other through a stale
   *  `selected` array. */
  onAssign: (id: PlayerId) => void
}) {
  const { t } = useTranslation()
  const roster = useAppStore((s) => s.roster)
  const addRosterPlayer = useAppStore((s) => s.addRosterPlayer)
  const order = usePlayerOrder((s) => s.order)
  const [name, setName] = useState('')
  /** The player whose card is open, held by id so the sheet follows edits made in it. */
  const [openId, setOpenId] = useState<PlayerId | null>(null)

  const chosen = new Set(selected)
  const open = roster.find((p) => p.id === openId) ?? null

  const toggle = (id: PlayerId) => {
    if (elsewhere.has(id)) {
      onAssign(id)
      return
    }
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
    // A name already on the roster comes back as the player it names, so retyping
    // someone who is in another level moves them rather than cloning them into two.
    if (player) onAssign(player.id)
  }

  // Free players first, then the ones another level is holding: the common tap is at
  // the front, and the moves are grouped together at the end where they read as a
  // deliberate act rather than a slip. The chosen order runs inside each half, not
  // across the two, so the split survives it.
  const { free, held } = useMemo(
    () => ({
      free: orderPlayers(
        roster.filter((p) => !elsewhere.has(p.id)),
        order,
      ),
      held: orderPlayers(
        roster.filter((p) => elsewhere.has(p.id)),
        order,
      ),
    }),
    [roster, elsewhere, order],
  )

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

      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-court-600 dark:text-court-200">
        <span>{t('roster.selected', { count: selected.length })}</span>
        {free.length > 0 ? (
          <button
            type="button"
            className="rounded-lg px-2 py-1 underline underline-offset-2 transition hover:bg-court-100 dark:hover:bg-court-800"
            // Only the free players: "add all" must never quietly empty another level.
            onClick={() => onChange(free.map((p) => p.id))}
          >
            {t('roster.addAll')}
          </button>
        ) : null}
        {selected.length > 0 ? (
          <button
            type="button"
            className="rounded-lg px-2 py-1 underline underline-offset-2 transition hover:bg-court-100 dark:hover:bg-court-800"
            onClick={() => onChange([])}
          >
            {t('roster.clearSelection')}
          </button>
        ) : null}
        <div className="flex-1" />
        {roster.length > 0 ? <PlayerOrderToggle /> : null}
      </div>

      {roster.length === 0 ? (
        <p className="rounded-xl bg-court-100 px-3 py-4 text-center text-sm text-court-600 dark:bg-court-800 dark:text-court-200">
          {t('roster.empty')}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {[...free, ...held].map((player) => {
            const on = chosen.has(player.id)
            const holder = elsewhere.get(player.id)
            const dim = holder ? 'opacity-70' : ''
            return (
              // Two buttons in one pill rather than one nested in the other, which is
              // invalid and would make the whole chip ambiguous to tap: the name
              // picks, the "i" opens the card. Logical rounding, so the pill reads
              // the same way round in both directions.
              <span key={player.id} className="inline-flex items-stretch">
                <Tooltip
                  label={
                    holder
                      ? t('roster.tapToMove', { level: holder })
                      : on
                        ? t('roster.tapToRemove')
                        : t('roster.tapToAdd')
                  }
                >
                  <Chip
                    selected={on}
                    onClick={() => toggle(player.id)}
                    className={`!rounded-s-full !rounded-e-none !pe-3 ${dim}`}
                  >
                    {on ? '✓ ' : ''}
                    {player.name}
                    {/* Shown only in rank order, where it is the reason the list is
                        arranged this way. In A–Z order it would be a number on every
                        chip explaining nothing. */}
                    {order === 'rank' && player.rank !== undefined ? (
                      <span
                        className={`ms-1.5 text-xs font-normal tabular-nums ${
                          on ? 'text-white/80' : 'text-court-500 dark:text-court-300'
                        }`}
                      >
                        <Ltr>{player.rank}</Ltr>
                      </span>
                    ) : null}
                    {holder ? (
                      <span
                        className={`ms-1.5 text-xs font-normal ${
                          on ? 'text-white/80' : 'text-court-500 dark:text-court-300'
                        }`}
                      >
                        {t('roster.inLevel', { level: holder })}
                      </span>
                    ) : null}
                  </Chip>
                </Tooltip>
                <Tooltip label={t('roster.openHint', { name: player.name })}>
                  <button
                    type="button"
                    aria-label={t('roster.openHint', { name: player.name })}
                    onClick={() => setOpenId(player.id)}
                    // The unselected chip's own ring already draws the seam between
                    // the two halves; the selected one is solid, so it needs a line.
                    className={`${on ? chipOnClass : chipOffClass} !rounded-s-none !rounded-e-full !px-3 ${
                      on ? 'border-s border-white/30' : ''
                    } ${dim}`}
                  >
                    {/* Drawn rather than borrowed from a glyph: ⓘ is at the mercy of
                        whichever font the device falls back to for it. */}
                    <span
                      aria-hidden="true"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current font-serif text-xs italic"
                    >
                      i
                    </span>
                  </button>
                </Tooltip>
              </span>
            )
          })}
        </div>
      )}

      {/* The card is a sheet over the wizard, not a route: the draft being composed
          behind it survives opening someone's record, which is the whole point of
          the "i". Its history rows are therefore inert here — one tap through to an
          old tournament would take the half-entered night with it. */}
      <PlayerSheet player={open} onClose={() => setOpenId(null)} historyLinks={false} />
    </div>
  )
}
