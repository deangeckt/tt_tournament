import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import { Avatar, Button, Card, Ltr, PageTitle, inputClass } from '../components/common/ui'
import { Tooltip } from '../components/common/Tooltip'
import { PlayerSheet } from '../components/player/PlayerSheet'
import { ImportPrompt } from '../components/data/ImportPrompt'
import { toast } from '../store/useToasts'
import { navigate } from '../router'

export function Roster() {
  const { t } = useTranslation()
  const roster = useAppStore((s) => s.roster)
  const loaded = useAppStore((s) => s.loaded)
  const addRosterPlayer = useAppStore((s) => s.addRosterPlayer)
  const removeRosterPlayer = useAppStore((s) => s.removeRosterPlayer)
  const [name, setName] = useState('')
  /** Held by id, not by object, so the sheet follows edits made inside it. */
  const [openId, setOpenId] = useState<string | null>(null)

  const open = roster.find((p) => p.id === openId) ?? null

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const pending = name.trim()
    if (!pending) return
    // Cleared before the await so fast typing cannot append to the previous name.
    setName('')
    const player = await addRosterPlayer(pending)
    if (player) toast(t('edit.playerAdded', { name: player.name }))
  }

  const remove = async (id: string, playerName: string) => {
    await removeRosterPlayer(id)
    toast(t('edit.playerRemoved', { name: playerName }), 'warn', {
      label: t('feedback.undo'),
      run: () => void addRosterPlayer(playerName),
    })
  }

  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'home' })}>
          ← {t('nav.back')}
        </Button>
      </div>

      <PageTitle sub={t('roster.hint')}>{t('roster.title')}</PageTitle>

      <form onSubmit={submit} className="mb-5 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('roster.addPlaceholder')}
          className={inputClass}
          autoComplete="off"
        />
        <Button type="submit" disabled={!name.trim()}>
          {t('common.add')}
        </Button>
      </form>

      {roster.length === 0 ? (
        // The list is empty for two very different reasons — a brand new device, or a
        // device that has lost its data — and the answer to both is the same file.
        loaded ? (
          <ImportPrompt />
        ) : (
          <Card className="text-center text-court-600 dark:text-court-200">{t('roster.empty')}</Card>
        )
      ) : (
        <ul className="divide-y divide-court-100 overflow-hidden rounded-2xl bg-white ring-1 ring-court-100 dark:divide-court-800 dark:bg-court-900 dark:ring-court-800">
          {roster.map((player) => (
            <li key={player.id} className="flex items-center">
              {/* The row and the delete button are siblings rather than nested, so
                  the whole name is a large tap target without swallowing the X. */}
              <button
                type="button"
                onClick={() => setOpenId(player.id)}
                className="flex min-h-14 flex-1 items-center gap-3 px-4 py-3 text-start transition hover:bg-court-50 dark:hover:bg-court-800"
              >
                <Avatar name={player.name} photo={player.photo} />
                <span className="min-w-0 flex-1 truncate">{player.name}</span>
                {/* The one number that changes how the night is drawn, so it belongs
                    on the row rather than one tap inside it — a manager scanning for
                    who still needs a rank should not have to open twenty sheets. */}
                {player.rank !== undefined ? (
                  <span className="shrink-0 rounded-lg bg-court-100 px-2 py-1 text-sm font-medium text-court-600 tabular-nums dark:bg-court-800 dark:text-court-200">
                    <Ltr>{player.rank}</Ltr>
                  </span>
                ) : null}
                {/* Flipped rather than swapped for a different glyph: one arrow,
                    pointing whichever way "forward" happens to be. */}
                <span
                  aria-hidden="true"
                  className="text-court-500 rtl:-scale-x-100 dark:text-court-300"
                >
                  ›
                </span>
              </button>
              <Tooltip label={t('roster.removeHint', { name: player.name })}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="me-2"
                  onClick={() => void remove(player.id, player.name)}
                  aria-label={t('roster.removeHint', { name: player.name })}
                >
                  ✕
                </Button>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}

      <PlayerSheet player={open} onClose={() => setOpenId(null)} />
    </>
  )
}
