import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import { Button, Card, PageTitle, inputClass } from '../components/common/ui'
import { Tooltip } from '../components/common/Tooltip'
import { toast } from '../store/useToasts'

export function Roster() {
  const { t } = useTranslation()
  const roster = useAppStore((s) => s.roster)
  const addRosterPlayer = useAppStore((s) => s.addRosterPlayer)
  const removeRosterPlayer = useAppStore((s) => s.removeRosterPlayer)
  const [name, setName] = useState('')

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
            <li
              key={player.id}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-court-50 dark:hover:bg-court-800"
            >
              <span className="flex-1">{player.name}</span>
              <Tooltip label={t('roster.removeHint', { name: player.name })}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void remove(player.id, player.name)}
                  aria-label={`${t('common.delete')} ${player.name}`}
                >
                  ✕
                </Button>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
