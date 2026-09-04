import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRoute, hrefFor, navigate } from './router'
import { applyLocale, detectLocale } from './i18n'
import { useAppStore } from './store/useAppStore'
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

function Header() {
  const { t } = useTranslation()
  const route = useRoute()
  return (
    <header className="no-print sticky top-0 z-20 border-b border-court-100 bg-court-50/85 backdrop-blur dark:border-court-800 dark:bg-court-950/85">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-3">
        {/* The title is also the way home from every screen, so it carries the
            app's full name at a size that reads as a heading rather than a
            breadcrumb. It shrinks before the controls do. */}
        <a
          href={hrefFor({ name: 'home' })}
          className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-lg font-extrabold
            tracking-tight transition hover:text-court-600 sm:text-xl dark:hover:text-court-200"
        >
          <span aria-hidden="true" className="shrink-0 text-2xl">
            🏓
          </span>
          <span className="truncate">{t('app.title')}</span>
        </a>
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
