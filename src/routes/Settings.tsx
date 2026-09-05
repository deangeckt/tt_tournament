import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import {
  backupFilename,
  buildBackup,
  downloadText,
  importBackup,
  parseBackup,
  shareTextFile,
  type ImportMode,
} from '../store/backup'
import { applyLocale, type Locale } from '../i18n'
import { useTheme } from '../store/useTheme'
import { THEMES, type ThemePref } from '../store/theme'
import { Button, Card, Chip, PageTitle } from '../components/common/ui'
import { Tooltip } from '../components/common/Tooltip'
import { toast } from '../store/useToasts'
import { navigate } from '../router'

/**
 * The advanced drawer: everything that is about the app's data rather than about
 * tonight's tournament.
 *
 * Export and import are the headline items because they are the only answer to the
 * one thing a browser-only app cannot do for itself — survive a cleared cache, and
 * move a club's history from the manager's phone to the club laptop.
 */
export function Settings() {
  const { t, i18n } = useTranslation()
  const roster = useAppStore((s) => s.roster)
  const tournaments = useAppStore((s) => s.tournaments)
  const load = useAppStore((s) => s.load)
  const fileInput = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<ImportMode>('merge')
  const themePref = useTheme((s) => s.pref)
  const setThemePref = useTheme((s) => s.setPref)

  const backupText = () => JSON.stringify(buildBackup(roster, tournaments), null, 2)

  /**
   * Two counts, each pluralised on its own. Hebrew has a dual form, so "1 tournaments"
   * is not the only thing a single interpolated sentence would get wrong — and
   * i18next can only pluralise one count per key.
   */
  const counts = (tournamentTotal: number, playerTotal: number) =>
    `${t('settings.tournamentCount', { count: tournamentTotal })} · ${t('home.players', {
      count: playerTotal,
    })}`

  const exportFile = () => {
    downloadText(backupFilename(), backupText())
    toast(t('settings.exportDone'))
  }

  const shareFile = async () => {
    const where = await shareTextFile(backupFilename(), backupText(), t('settings.shareHistory'))
    toast(where === 'shared' ? t('settings.shared') : t('settings.exportDone'))
  }

  const importFile = async (file: File | undefined) => {
    if (!file) return
    const backup = parseBackup(await file.text())
    if (!backup) {
      toast(t('settings.importFailed'), 'warn')
      return
    }
    const imported = await importBackup(backup, mode)
    await load()
    toast(t('settings.importDone', { summary: counts(imported.tournaments, imported.players) }))
  }

  const THEME_LABELS: Record<ThemePref, string> = {
    system: t('settings.themeSystem'),
    light: t('settings.themeLight'),
    dark: t('settings.themeDark'),
  }

  const switchTheme = (pref: ThemePref) => {
    setThemePref(pref)
    toast(t('feedback.themeChanged'), 'info')
  }

  const switchTo = (locale: Locale) => {
    void i18n.changeLanguage(locale)
    applyLocale(locale)
    toast(t('feedback.languageChanged', { lng: locale }), 'info')
  }

  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'home' })}>
          ← {t('nav.back')}
        </Button>
      </div>

      <PageTitle sub={counts(tournaments.length, roster.length)}>
        {t('settings.title')}
      </PageTitle>

      <Card className="mb-4 space-y-4">
        <div>
          <h2 className="text-lg font-bold">{t('settings.dataTitle')}</h2>
          <p className="mt-1 text-court-600 dark:text-court-200">{t('settings.dataHint')}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Tooltip label={t('settings.exportHint')}>
            <Button variant="subtle" onClick={exportFile}>
              ⬇ {t('settings.export')}
            </Button>
          </Tooltip>
          <Tooltip label={t('settings.shareHistoryHint')}>
            <Button onClick={() => void shareFile()}>↗ {t('settings.shareHistory')}</Button>
          </Tooltip>
        </div>

        <div className="border-t border-court-100 pt-4 dark:border-court-800">
          <h3 className="font-bold">{t('settings.import')}</h3>
          <p className="mt-1 mb-2 text-sm text-court-600 dark:text-court-200">
            {t('settings.importHint')}
          </p>
          <div className="mb-2 flex flex-wrap gap-2">
            <Chip selected={mode === 'merge'} onClick={() => setMode('merge')}>
              {t('settings.importMerge')}
            </Chip>
            <Chip selected={mode === 'replace'} onClick={() => setMode('replace')}>
              {t('settings.importReplace')}
            </Chip>
          </div>
          {mode === 'replace' ? (
            <p className="mb-2 rounded-xl bg-ball-500/12 px-3 py-2 text-sm text-ball-600">
              {t('settings.importReplaceWarn')}
            </p>
          ) : null}
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              void importFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <Button variant="subtle" size="sm" onClick={() => fileInput.current?.click()}>
            ⬆ {t('settings.import')}
          </Button>
        </div>
      </Card>

      <Card className="mb-4 space-y-2">
        <h2 className="text-lg font-bold">{t('settings.languageTitle')}</h2>
        <div className="flex flex-wrap gap-2">
          <Chip selected={i18n.language === 'he'} onClick={() => switchTo('he')}>
            עברית
          </Chip>
          <Chip selected={i18n.language === 'en'} onClick={() => switchTo('en')}>
            English
          </Chip>
        </div>
      </Card>

      <Card className="mb-4 space-y-2">
        <h2 className="text-lg font-bold">{t('settings.themeTitle')}</h2>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((pref) => (
            <Chip key={pref} selected={themePref === pref} onClick={() => switchTheme(pref)}>
              <span aria-hidden="true" className="me-1.5">
                {pref === 'system' ? '🖥' : pref === 'light' ? '☀' : '🌙'}
              </span>
              {THEME_LABELS[pref]}
            </Chip>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="text-lg font-bold">{t('settings.storageTitle')}</h2>
        <p className="mt-1 text-court-600 dark:text-court-200">{t('settings.storageHint')}</p>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">{t('settings.aboutTitle')}</h2>
        <p className="mt-1 text-court-600 dark:text-court-200">{t('settings.aboutText')}</p>
      </Card>
    </>
  )
}
