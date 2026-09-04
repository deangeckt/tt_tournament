import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import { Button, Card, PageTitle, inputClass } from '../components/common/ui'

export function Roster() {
  const { t } = useTranslation()
  const roster = useAppStore((s) => s.roster)
  const addRosterPlayer = useAppStore((s) => s.addRosterPlayer)
  const removeRosterPlayer = useAppStore((s) => s.removeRosterPlayer)
  const [name, setName] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    await addRosterPlayer(name)
    setName('')
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
            <li key={player.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1">{player.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void removeRosterPlayer(player.id)}
                aria-label={`${t('common.delete')} ${player.name}`}
              >
                ✕
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
