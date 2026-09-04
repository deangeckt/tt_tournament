import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import { Avatar, Button, Card, PageTitle, inputClass } from '../components/common/ui'
import { Tooltip } from '../components/common/Tooltip'
import { PlayerSheet } from '../components/player/PlayerSheet'
import { toast } from '../store/useToasts'
import { navigate } from '../router'

export function Roster() {
  const { t } = useTranslation()
  const roster = useAppStore((s) => s.roster)
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
        <Card className="text-center text-court-600 dark:text-court-200">{t('roster.empty')}</Card>
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
                {/* Flipped rather than swapped for a different glyph: one arrow,
                    pointing whichever way "forward" happens to be. */}
                <span
                  aria-hidden="true"
                  className="text-court-300 rtl:-scale-x-100 dark:text-court-600"
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
