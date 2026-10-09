import { useTranslation } from 'react-i18next'
import { install, useInstall } from '../../store/useInstall'
import { Button, Card } from '../common/ui'

/**
 * Putting the app on the home screen, from the settings screen.
 *
 * Installed, it opens like any other app and — the part a club cares about — it is
 * the browser's own signal that this site's data is worth keeping, which is what
 * stops Safari wiping a roster nobody has opened for a week.
 *
 * Chromium hands over an install dialog to show; Safari has no such thing, so on an
 * iPhone or iPad the card can only say where the menu item is. It says one more thing
 * there, and it is the one that would otherwise lose somebody their history: a
 * home-screen app on iOS keeps storage of its own, apart from Safari's, so it opens
 * empty. The restore prompt picks that up on arrival — if there is a backup to give it.
 */
export function InstallCard() {
  const { t } = useTranslation()
  const way = useInstall((s) => s.way)

  if (way === 'standalone' || way === 'none') return null

  return (
    <Card className="mb-4 space-y-3">
      <div>
        <h2 className="text-lg font-bold">{t('install.title')}</h2>
        <p className="mt-1 text-court-600 dark:text-court-200">
          {way === 'installed' ? t('install.installed') : t('install.hint')}
        </p>
      </div>

      {way === 'prompt' ? (
        <Button onClick={() => void install()}>⤓ {t('install.action')}</Button>
      ) : null}

      {way === 'ios' ? (
        <>
          <p className="font-medium">{t('install.ios')}</p>
          <p className="rounded-xl bg-ball-500/12 px-3 py-2 text-sm text-ball-600">
            {t('install.iosData')}
          </p>
        </>
      ) : null}
    </Card>
  )
}
