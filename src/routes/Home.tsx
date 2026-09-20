import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import { navigate } from '../router'
import { Button, Card, PageTitle } from '../components/common/ui'
import { ImportPrompt } from '../components/data/ImportPrompt'

/**
 * The six the first-run card leads with, out of the thirteen the about screen
 * expands on. Headlines only: somebody who has just arrived is deciding whether to
 * tap Create, not reading a manual — the rest, the consolation among them, is a tap
 * away rather than in front of somebody who has not run anything yet.
 */
const HIGHLIGHTS = [
  'formats',
  'draw',
  'ranks',
  'standings',
  'sharing',
  'players',
] as const

export function Home() {
  const { t, i18n } = useTranslation()
  const tournaments = useAppStore((s) => s.tournaments)
  const roster = useAppStore((s) => s.roster)
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
          {/* Only ever read by someone who has never run a tournament here — and by
              a crawler, which lands on empty storage every time. Regulars have a
              list instead and never see it. The h1 above is the nav's own word for
              this screen, so what the app actually does is named here, in the one
              heading a rendering crawler finds with prose under it. */}
          <h2 className="mt-5 text-base font-semibold">{t('home.emptyAboutTitle')}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-court-600 dark:text-court-200">
            {t('home.emptyAbout')}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-court-600 dark:text-court-200">
            {t('home.emptyAboutFree')}
          </p>
          {/* The about screen's own headlines, so the two cannot drift. The list is
              centred as a block but its lines are not: w-fit shrinks it to its widest
              headline so the bullets sit in one column, which centred text would
              scatter. */}
          <ul className="mx-auto mt-4 w-fit max-w-md list-disc space-y-1.5 ps-5 text-start text-sm">
            {HIGHLIGHTS.map((id) => (
              <li key={id}>{t(`about.${id}Title`)}</li>
            ))}
          </ul>
          <Button
            variant="subtle"
            size="sm"
            className="mt-4"
            onClick={() => navigate({ name: 'about' })}
          >
            {t('about.title')}
          </Button>
        </Card>
      ) : null}

      {/* Only on a device with nothing at all on it. A manager who already has a
          roster does not need to be asked, and one mid-season with tournaments but
          no saved players is in a state a restore would not explain. */}
      {loaded && tournaments.length === 0 && roster.length === 0 ? (
        <ImportPrompt className="mt-4" />
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
