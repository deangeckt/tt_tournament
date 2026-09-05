import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRoute, hrefFor, navigate } from './router'
import logo from './assets/logo.webp'
import { applyLocale, detectLocale } from './i18n'
import { useAppStore } from './store/useAppStore'
import { useTheme } from './store/useTheme'
import { applyTheme } from './store/theme'
import { requestPersistence } from './store/db'
import { Home } from './routes/Home'
import { NewTournament } from './routes/NewTournament'
import { Run } from './routes/Run'
import { Roster } from './routes/Roster'
import { Settings } from './routes/Settings'
import { ViewShared } from './routes/ViewShared'
import { Button } from './components/common/ui'
import { Tooltip } from './components/common/Tooltip'
import { ToastHost } from './components/common/Toast'

const CLUB_URL =
  'https://www.facebook.com/p/%D7%97%D7%95%D7%92%D7%99-%D7%98%D7%A0%D7%99%D7%A1-%D7%A9%D7%95%D7%9C%D7%97%D7%9F-%D7%91%D7%97%D7%99%D7%A4%D7%94-%D7%95%D7%94%D7%A6%D7%A4%D7%95%D7%9F-61564986761748/'

function Header() {
  const { t } = useTranslation()
  const route = useRoute()
  return (
    <header className="no-print sticky top-0 z-20 border-b border-court-100 bg-court-50/85 backdrop-blur dark:border-court-800 dark:bg-court-950/85">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-3">
        {/* Two controls that look like one lockup: the emblem leaves for the club's
            page, the title is the way home from every screen. Keeping them separate
            is why the emblem carries its own label — it is no longer decoration. */}
        <div className="flex min-w-0 items-center gap-2">
          <Tooltip label={t('nav.clubHint')} side="bottom">
            <a
              href={CLUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('nav.club')}
              className="group flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full"
            >
              {/* The club emblem is drawn on white paper, so it ships as a disc cut
                  on its own navy ring (scripts/make-logo.mjs) rather than a square
                  that would sit in a white box under dark mode. */}
              <img
                src={logo}
                alt=""
                width={192}
                height={192}
                className="h-9 w-9 select-none rounded-full ring-court-400 transition
                  group-hover:ring-2 sm:h-10 sm:w-10 dark:ring-court-300"
              />
            </a>
          </Tooltip>
          {/* The title carries the app's full name at a size that reads as a heading
              rather than a breadcrumb. It shrinks before the controls do. */}
          <a
            href={hrefFor({ name: 'home' })}
            className="min-w-0 truncate rounded-lg px-1 py-1 text-lg font-extrabold tracking-tight
              transition hover:text-court-600 sm:text-xl dark:hover:text-court-200"
          >
            {t('app.title')}
          </a>
        </div>
        <div className="flex-1" />
        {route.name !== 'roster' ? (
          <Tooltip label={t('roster.hint')} side="bottom">
            <Button
              variant="ghost"
              size="sm"
              className="px-2.5"
              onClick={() => navigate({ name: 'roster' })}
              aria-label={t('nav.roster')}
            >
              <span aria-hidden="true">👥</span>
              <span className="hidden sm:inline">{t('nav.roster')}</span>
            </Button>
          </Tooltip>
        ) : null}
        {route.name !== 'settings' ? (
          <Tooltip label={t('nav.settings')} side="bottom">
            <Button
              variant="ghost"
              size="sm"
              className="px-2.5"
              onClick={() => navigate({ name: 'settings' })}
              aria-label={t('nav.settings')}
            >
              <span aria-hidden="true">⚙</span>
              <span className="hidden sm:inline">{t('nav.settings')}</span>
            </Button>
          </Tooltip>
        ) : null}
      </div>
    </header>
  )
}

export function App() {
  const route = useRoute()
  const load = useAppStore((s) => s.load)

  useEffect(() => {
    applyLocale(detectLocale())
    // The inline script in index.html has already stamped the attribute; this is what
    // keeps the browser-chrome colour and the stored preference in step with it.
    applyTheme(useTheme.getState().pref)
    void load()
    void requestPersistence()
  }, [load])

  return (
    <div className="min-h-full">
      <Header />
      {/* The bottom padding clears both the toast stack and a phone's home indicator. */}
      <main
        className="mx-auto max-w-3xl px-4 py-6"
        style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
      >
        {route.name === 'home' && <Home />}
        {route.name === 'new' && <NewTournament />}
        {route.name === 'roster' && <Roster />}
        {route.name === 'settings' && <Settings />}
        {route.name === 'view' && <ViewShared payload={route.payload} />}
        {route.name === 'run' && <Run id={route.id} />}
      </main>
      <ToastHost />
    </div>
  )
}
