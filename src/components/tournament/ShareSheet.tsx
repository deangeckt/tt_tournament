import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import QRCode from 'qrcode'
import type { Tournament } from '../../engine/types'
import { SAFE_URL_LENGTH, shareUrl } from '../../share/payload'
import { SHORTENABLE_URL_LENGTH, shortenUrl } from '../../share/shorten'
import { summaryText } from '../../share/summary'
import { Button, Ltr } from '../common/ui'
import { Sheet } from '../common/Sheet'
import { toast } from '../../store/useToasts'

export function ShareSheet({
  open,
  onClose,
  tournament,
}: {
  open: boolean
  onClose: () => void
  tournament: Tournament
}) {
  const { t } = useTranslation()
  /** Carries the url it was generated from, so a stale code is never shown. */
  const [qr, setQr] = useState<{ url: string; data: string } | null>(null)
  /** Also carries its long url: a roster edit invalidates the short link. */
  const [short, setShort] = useState<{ long: string; url: string } | null>(null)
  /** The long url a shortener already failed on, so the effect stops retrying it. */
  const [failed, setFailed] = useState<string | null>(null)

  const longUrl = useMemo(() => (open ? shareUrl(tournament) : ''), [open, tournament])
  const tooLong = longUrl.length > SAFE_URL_LENGTH
  const shortUrl = short?.long === longUrl ? short.url : null
  const canShorten = !tooLong && longUrl.length <= SHORTENABLE_URL_LENGTH
  /**
   * A request is in flight exactly when a link can be shortened and neither answer has
   * arrived yet — which is a fact about the other three values, not a fourth thing to
   * keep in step with them. It is also what triggers the effect below, so the spinner
   * and the request can never disagree.
   */
  const shortening = open && canShorten && !shortUrl && failed !== longUrl
  // Everything downstream — clipboard, QR, WhatsApp — uses the one link there is. The
  // long url is a fallback, not a choice: it appears only when no shortener answered
  // or the tournament is too large for one.
  const url = shortUrl ?? longUrl
  const summary = useMemo(() => (open ? summaryText(tournament, t) : ''), [open, tournament, t])
  const message = tooLong ? summary : `${summary}\n\n${url}`

  /**
   * Shorten as soon as the sheet opens.
   *
   * This is the one place data leaves the device, and it is no longer something the
   * user asks for per link — so it has to be said plainly rather than buried: the note
   * under the link says the tournament is uploaded to an outside service. The fragment
   * still keeps it away from *our* server, and `shortenUrl` caches, so re-opening the
   * sheet costs nothing and the code someone already printed keeps matching what is on
   * screen.
   */
  useEffect(() => {
    if (!shortening) return
    let live = true
    void shortenUrl(longUrl).then((result) => {
      if (!live) return
      if (result) setShort({ long: longUrl, url: result })
      // Remembered rather than toasted: a shortener being down is not worth an alert
      // on a sheet the user only opened to read a link, and the note under it says so.
      else setFailed(longUrl)
    })
    return () => {
      live = false
    }
  }, [shortening, longUrl])

  useEffect(() => {
    if (!open || tooLong) return
    let live = true
    // A QR code has a hard capacity, and a big tournament simply will not fit. That
    // is not an error worth showing — the link and the printout still work — so the
    // block is dropped instead. A shortened link always fits.
    QRCode.toDataURL(url, { margin: 1, width: 320, errorCorrectionLevel: 'L' })
      .then((data) => {
        if (live) setQr({ url, data })
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [open, url, tooLong])

  const qrImage = qr?.url === url ? qr.data : null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast(t('feedback.linkCopied'))
    } catch {
      toast(t('feedback.copyFailed'), 'warn')
    }
  }

  const print = () => {
    onClose()
    // Let the sheet finish sliding away, or it lands in the printout.
    setTimeout(() => window.print(), 350)
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('share.title')}>
      <div className="space-y-5">
        <section className="space-y-2">
          <h3 className="font-bold">{t('share.linkTitle')}</h3>
          <p className="text-sm text-court-600 dark:text-court-200">{t('share.linkHint')}</p>
          {tooLong ? (
            <p className="rounded-xl bg-ball-500/12 px-3 py-2 text-sm text-ball-600">
              {t('share.tooLong')}
            </p>
          ) : (
            <>
              <div className="max-h-20 overflow-y-auto rounded-xl bg-court-100 px-3 py-2 text-xs break-all dark:bg-court-800">
                <Ltr>{url}</Ltr>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void copy()}>
                  🔗 {t('share.copyLink')}
                </Button>
                {/* The only thing to press about shortening: try the services again
                    after one of them was down. Clearing the failure restarts the
                    effect. */}
                {canShorten && failed === longUrl ? (
                  <Button variant="subtle" size="sm" onClick={() => setFailed(null)}>
                    ✂️ {t('share.shorten')}
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-court-500 dark:text-court-300">
                {shortening
                  ? t('share.shortening')
                  : shortUrl
                    ? t('share.shortHint')
                    : canShorten
                      ? t('share.shortenFailed')
                      : t('share.shortenTooLong')}
              </p>
            </>
          )}
        </section>

        <section className="space-y-2 border-t border-court-100 pt-4 dark:border-court-800">
          <h3 className="font-bold">{t('share.summary')}</h3>
          <div className="flex flex-wrap gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded-xl bg-white px-3.5 py-2 text-sm font-medium ring-1 ring-court-200 transition hover:bg-court-100 dark:bg-court-900 dark:ring-court-700 dark:hover:bg-court-800"
            >
              💬 {t('share.whatsapp')}
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent(tournament.name)}&body=${encodeURIComponent(message)}`}
              className="inline-flex min-h-11 items-center rounded-xl bg-white px-3.5 py-2 text-sm font-medium ring-1 ring-court-200 transition hover:bg-court-100 dark:bg-court-900 dark:ring-court-700 dark:hover:bg-court-800"
            >
              ✉️ {t('share.email')}
            </a>
          </div>
          <pre className="max-h-40 overflow-y-auto rounded-xl bg-court-100 px-3 py-2 text-xs whitespace-pre-wrap dark:bg-court-800">
            {summary}
          </pre>
        </section>

        {qrImage ? (
          <section className="space-y-2 border-t border-court-100 pt-4 dark:border-court-800">
            <h3 className="font-bold">{t('share.qrTitle')}</h3>
            <p className="text-sm text-court-600 dark:text-court-200">{t('share.qrHint')}</p>
            <img
              src={qrImage}
              alt={t('share.qrTitle')}
              className="mx-auto h-52 w-52 rounded-xl bg-white p-2"
            />
          </section>
        ) : null}

        <section className="space-y-2 border-t border-court-100 pt-4 dark:border-court-800">
          <h3 className="font-bold">{t('share.printTitle')}</h3>
          <p className="text-sm text-court-600 dark:text-court-200">{t('share.printHint')}</p>
          <Button variant="subtle" size="sm" onClick={print}>
            🖨 {t('common.print')}
          </Button>
        </section>

        <Button className="w-full" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </Sheet>
  )
}
