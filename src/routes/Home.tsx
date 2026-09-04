import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import { navigate } from '../router'
import { Button, Card, PageTitle } from '../components/common/ui'

export function Home() {
  const { t, i18n } = useTranslation()
  const tournaments = useAppStore((s) => s.tournaments)
  const loaded = useAppStore((s) => s.loaded)

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })

  return (
    <>
      <PageTitle sub={t('app.tagline')}>{t('nav.home')}</PageTitle>

      <Button className="mb-6 w-full text-lg" onClick={() => navigate({ name: 'new' })}>
        + {t('home.create')}
      </Button>

      {loaded && tournaments.length === 0 ? (
        <Card className="text-center">
          <p className="text-lg font-medium">{t('home.empty')}</p>
          <p className="mt-1 text-court-600 dark:text-court-200">{t('home.emptyHint')}</p>
        </Card>
      ) : null}

      <ul className="space-y-3">
        {tournaments.map((tournament) => {
          const playerCount = tournament.players.length
          return (
            <li key={tournament.id}>
              <button
                onClick={() => navigate({ name: 'run', id: tournament.id })}
                className="w-full rounded-2xl bg-white p-5 text-start ring-1 ring-court-100 transition-all
                  duration-150 hover:-translate-y-px hover:bg-court-50 hover:shadow-md hover:ring-court-400
                  active:scale-[0.99] dark:bg-court-900 dark:ring-court-800 dark:hover:bg-court-800"
              >
                <div className="text-lg font-bold">{tournament.name}</div>
                <div className="mt-1 text-court-600 dark:text-court-200">
                  {dateFormat.format(new Date(tournament.date))} ·{' '}
                  {t('home.players', { count: playerCount })}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
