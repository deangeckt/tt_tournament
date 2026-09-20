import { useTranslation } from 'react-i18next'
import { navigate } from '../router'
import { Button, Card, PageTitle, chipOffClass } from '../components/common/ui'
import { CLUB_URL, SOURCE_URL } from '../links'

/**
 * What the app does, and — the half that is harder to find anywhere else — what it
 * does not.
 *
 * A club manager is being asked to trust an evening of results to a page with no
 * account behind it, and the honest answer to "what happens to my data" is several
 * sentences long: it is in one browser, a short link is made by somebody else's
 * server, a ranking lookup passes through a relay. None of that fits in a tooltip,
 * and a screen nobody has to read is the right place for it.
 *
 * The lists are ids rather than markup so the copy stays in `i18n/` where it can be
 * translated, and so the home screen's empty state can borrow the same headlines
 * without a second list to keep in step.
 */

/** Read in this order. Home's first-run card shows a subset of these headlines. */
const FEATURES = [
  'formats',
  'levels',
  'draw',
  'ranks',
  'order',
  'consolation',
  'scoring',
  'standings',
  'editing',
  'players',
  'sharing',
  'backup',
  'device',
] as const

/**
 * Capitalised because the keys read `limitShortLinkTitle` — the limits share the
 * `about` namespace with the features and would otherwise collide with them.
 */
const LIMITS = [
  'Device',
  'Sync',
  'ShortLink',
  'DoubleElim',
  'Retired',
  'Withdraw',
  'Tables',
  'Online',
] as const

export function About() {
  const { t } = useTranslation()

  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'home' })}>
          ← {t('nav.back')}
        </Button>
      </div>

      <PageTitle sub={t('app.tagline')}>{t('about.title')}</PageTitle>

      <Card className="mb-4">
        <p className="leading-relaxed">{t('about.lead')}</p>
      </Card>

      <Card className="mb-4">
        <h2 className="text-lg font-bold">{t('about.featuresTitle')}</h2>
        <div className="mt-4 space-y-5">
          {FEATURES.map((id) => (
            <section key={id}>
              <h3 className="font-semibold">{t(`about.${id}Title`)}</h3>
              <p className="mt-1 leading-relaxed text-court-600 dark:text-court-200">
                {t(`about.${id}Body`)}
              </p>
            </section>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="text-lg font-bold">{t('about.limitsTitle')}</h2>
        <p className="mt-1 text-court-600 dark:text-court-200">{t('about.limitsLead')}</p>
        <div className="mt-4 space-y-5">
          {LIMITS.map((id) => (
            <section key={id}>
              <h3 className="font-semibold">{t(`about.limit${id}Title`)}</h3>
              <p className="mt-1 leading-relaxed text-court-600 dark:text-court-200">
                {t(`about.limit${id}Body`)}
              </p>
            </section>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">{t('about.sourceTitle')}</h2>
        <p className="mt-1 text-court-600 dark:text-court-200">{t('about.sourceBody')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${chipOffClass} inline-flex items-center`}
          >
            {t('about.source')}
          </a>
          <a
            href={CLUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${chipOffClass} inline-flex items-center`}
          >
            {t('nav.club')}
          </a>
        </div>
      </Card>
    </>
  )
}
