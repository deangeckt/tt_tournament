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

function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const toggle = () => {
    const next: Locale = i18n.language === 'he' ? 'en' : 'he'
    void i18n.changeLanguage(next)
    applyLocale(next)
  }
  return (
    <Button variant="ghost" size="sm" onClick={toggle}>
      {t('common.language')}
    </Button>
  )
}

function Header() {
  const { t } = useTranslation()
  const route = useRoute()
  return (
    <header className="no-print sticky top-0 z-20 border-b border-court-100 bg-court-50/85 backdrop-blur dark:border-court-800 dark:bg-court-950/85">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
        <a href={hrefFor({ name: 'home' })} className="flex items-center gap-2 font-bold">
          <span aria-hidden="true" className="text-xl">
            🏓
          </span>
          <span>{t('app.title')}</span>
        </a>
        <div className="flex-1" />
        {route.name !== 'roster' ? (
          <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'roster' })}>
            {t('nav.roster')}
          </Button>
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
      <main className="mx-auto max-w-3xl px-4 py-6 pb-24">
        {route.name === 'home' && <Home />}
        {route.name === 'new' && <NewTournament />}
        {route.name === 'roster' && <Roster />}
        {route.name === 'run' && <Run id={route.id} />}
      </main>
    </div>
  )
}
