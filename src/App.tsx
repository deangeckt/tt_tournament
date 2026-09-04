import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRoute, hrefFor, navigate } from './router'
import { applyLocale, detectLocale, type Locale } from './i18n'
import { useAppStore } from './store/useAppStore'
import { requestPersistence } from './store/db'
import { Home } from './routes/Home'
import { NewTournament } from './routes/NewTournament'
import { Run } from './routes/Run'
import { Roster } from './routes/Roster'
import { Button } from './components/common/ui'
import { Tooltip } from './components/common/Tooltip'
import { ToastHost } from './components/common/Toast'
import { toast } from './store/useToasts'

function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const next: Locale = i18n.language === 'he' ? 'en' : 'he'
  return (
    <Tooltip label={next === 'en' ? 'Switch to English' : 'מעבר לעברית'} side="bottom">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          void i18n.changeLanguage(next)
          applyLocale(next)
          toast(t('feedback.languageChanged', { lng: next }), 'info')
        }}
      >
        {t('common.language')}
      </Button>
    </Tooltip>
  )
}

function Header() {
  const { t } = useTranslation()
  const route = useRoute()
  return (
    <header className="no-print sticky top-0 z-20 border-b border-court-100 bg-court-50/85 backdrop-blur dark:border-court-800 dark:bg-court-950/85">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-3">
        <a
          href={hrefFor({ name: 'home' })}
          className="flex items-center gap-2 rounded-lg px-1 py-1 text-lg font-bold transition hover:text-court-600 dark:hover:text-court-200"
        >
          <span aria-hidden="true" className="text-2xl">
            🏓
          </span>
          <span>{t('app.title')}</span>
        </a>
        <div className="flex-1" />
        {route.name !== 'roster' ? (
          <Tooltip label={t('roster.hint')} side="bottom">
            <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'roster' })}>
              {t('nav.roster')}
            </Button>
          </Tooltip>
        ) : null}
        <LanguageToggle />
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
        {route.name === 'run' && <Run id={route.id} />}
      </main>
      <ToastHost />
    </div>
  )
}
