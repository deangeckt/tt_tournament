/**
 * Turning a share link into a short one.
 *
 * The payload lives in the fragment, so a shortener has to store the whole thing —
 * which means the roster and every score leave the device and sit on someone else's
 * server. That is the exact property the fragment was chosen to protect, so this is
 * never automatic: the user asks for it, per link, and the sheet says what it costs.
 *
 * All three services are free and keyless. They are tried in order because none of
 * them promises uptime, and a shortener that is down should cost the user one toast,
 * not the share.
 */

/** Long enough that most services refuse it outright; failing early beats three timeouts. */
export const SHORTENABLE_URL_LENGTH = 5000

const TIMEOUT_MS = 8000

interface Provider {
  name: string
  /** Some services cap the url they will store, and say so only after the round trip. */
  maxLength?: number
  shorten: (url: string, signal: AbortSignal) => Promise<string>
}

/**
 * Every service here answers with 'Access-Control-Allow-Origin: *'. That is the whole
 * selection criterion and it rules most shorteners out — is.gd, tinyurl and cleanuri
 * all work fine from a server and are unreachable from a page, which is a failure the
 * browser reports as a generic network error.
 */
const PROVIDERS: Provider[] = [
  {
    name: 'da.gd',
    async shorten(url, signal) {
      const res = await fetch(`https://da.gd/shorten?url=${encodeURIComponent(url)}`, { signal })
      if (!res.ok) throw new Error(`da.gd ${res.status}`)
      return (await res.text()).trim()
    },
  },
  {
    name: 'spoo.me',
    async shorten(url, signal) {
      const res = await fetch('https://spoo.me/', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: `url=${encodeURIComponent(url)}`,
        signal,
      })
      const body = (await res.json()) as { short_url?: string }
      if (!res.ok || !body.short_url) throw new Error('spoo.me failed')
      // It hands back an http:// link for an https:// domain; the s costs nothing here
      // and spares the recipient a redirect.
      return body.short_url.replace(/^http:\/\//, 'https://')
    },
  },
  {
    // Posted rather than queried: past ~4000 characters a GET is refused by the front
    // end before the shortener ever sees it.
    name: 'clck.ru',
    maxLength: 4096,
    async shorten(url, signal) {
      const res = await fetch('https://clck.ru/--', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: `url=${encodeURIComponent(url)}`,
        signal,
      })
      if (!res.ok) throw new Error(`clck.ru ${res.status}`)
      return (await res.text()).trim()
    },
  },
]

/**
 * Same long link, same short link — a shortener would otherwise mint a new one on
 * every re-open of the sheet, and the code someone already printed would look wrong
 * next to it.
 */
const cache = new Map<string, string>()

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\/\S+$/.test(value)
}

/** Returns the short url, or null if no service could be reached. */
export async function shortenUrl(url: string): Promise<string | null> {
  if (url.length > SHORTENABLE_URL_LENGTH) return null
  const cached = cache.get(url)
  if (cached) return cached

  for (const provider of PROVIDERS) {
    if (provider.maxLength && url.length > provider.maxLength) continue
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const short = (await provider.shorten(url, controller.signal)).trim()
      if (looksLikeUrl(short)) {
        cache.set(url, short)
        return short
      }
    } catch {
      // Down, blocked by CORS, rate-limited — the next one may still answer.
    } finally {
      clearTimeout(timer)
    }
  }
  return null
}
