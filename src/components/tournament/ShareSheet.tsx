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
  const [shortening, setShortening] = useState(false)

  const longUrl = useMemo(() => (open ? shareUrl(tournament) : ''), [open, tournament])
  const tooLong = longUrl.length > SAFE_URL_LENGTH
  const shortUrl = short?.long === longUrl ? short.url : null
  // Everything downstream — clipboard, QR, WhatsApp — uses whichever link is current,
  // so shortening is one decision rather than four.
  const url = shortUrl ?? longUrl
  const summary = useMemo(() => (open ? summaryText(tournament, t) : ''), [open, tournament, t])
  const message = tooLong ? summary : `${summary}\n\n${url}`

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

  const shorten = async () => {
    if (longUrl.length > SHORTENABLE_URL_LENGTH) {
      toast(t('share.shortenTooLong'), 'warn')
      return
    }
    setShortening(true)
    const result = await shortenUrl(longUrl)
    setShortening(false)
    if (!result) {
      toast(t('share.shortenFailed'), 'warn')
      return
    }
    setShort({ long: longUrl, url: result })
    toast(t('share.shortened'))
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
                {shortUrl ? (
                  <Button variant="subtle" size="sm" onClick={() => setShort(null)}>
                    {t('share.showLong')}
                  </Button>
                ) : (
                  <Button
                    variant="subtle"
                    size="sm"
                    disabled={shortening}
                    onClick={() => void shorten()}
                  >
                    ✂️ {shortening ? t('share.shortening') : t('share.shorten')}
                  </Button>
                )}
              </div>
              {shortUrl ? null : (
                <p className="text-xs text-court-500 dark:text-court-300">
                  {t('share.shortenHint')}
                </p>
              )}
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
