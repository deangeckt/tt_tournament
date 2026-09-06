import { readPhoto } from '../store/photo'
import {
  nameFromUrl,
  parsePlayerCard,
  parseRankingRows,
  playerPageUrl,
  rankMatches,
  searchPageUrl,
  searchTerms,
  tttmIdFrom,
  type TttmPlayer,
} from './parse'

/**
 * Fetching from tttm.co.il, which a page cannot do by itself.
 *
 * This is the second place in the app where data leaves the device, and unlike the
 * first — where shortening a share link uploads the whole tournament — what leaves
 * here is one public URL at a time: which player was looked up, and when. Small, but
 * not nothing, so the sheet that triggers it says so rather than letting a relay
 * appear in the network tab unannounced.
 *
 * It has to be a relay. tttm.co.il answers without an 'Access-Control-Allow-Origin'
 * header, so the browser fetches the page and then refuses to hand it to us — the
 * same wall that ruled four shorteners out of share/shorten.ts, and there is no way
 * around it from a static site. Of the keyless relays that are still up, r.jina.ai is
 * the one that answers: it echoes the requesting origin back, handles the preflight
 * that the two headers below provoke, and does not rate-limit a manager typing names
 * one at a time.
 *
 * Asking it for `html` matters as much as reaching it at all. Left to itself the
 * relay returns its own Markdown rendering, which drops every image — so the photo
 * would be unreachable — and would make the app depend on how a third party chooses
 * to format tables. With `x-respond-with` it returns TTTM's own markup, and with
 * `x-target-selector` it returns only the part we asked for: a player's card comes
 * back as 946 bytes instead of the 1MB page it sits in, which is the difference
 * between a lookup and a download on a phone at the club.
 */
const RELAY = 'https://r.jina.ai/'

/** The player card at the top of /p/<id>/… — photo, name, club, category, points. */
const CARD_SELECTOR = '.playerPresentation'
/** The ranking table, which a search returns filtered to the matching players. */
const TABLE_SELECTOR = 'table.rank'

const TIMEOUT_MS = 12000

/**
 * What a lookup can come back as.
 *
 * 'none' and 'unreachable' are worth telling apart at every call site: one means the
 * league has never heard of this person and the manager should type the number or
 * paste a link, the other means the relay is down and the very same search will work
 * later. 'busy' is the relay's own rate limit, which is the one failure that clears
 * on its own within the minute.
 */
export type TttmResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'none' }
  | { kind: 'busy' }
  | { kind: 'unreachable' }

/**
 * Same fragment, same answer, for as long as the app is open.
 *
 * The sheet re-runs a search whenever it is reopened, and the relay counts every
 * request against a per-minute allowance. Nothing here is written, so a stale read
 * costs nothing worse than a rank that was already a week old.
 */
const cache = new Map<string, string>()

class RelayBusy extends Error {}

async function readFragment(url: string, selector: string): Promise<string> {
  const key = `${selector} ${url}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(RELAY + encodeURIComponent(url), {
      headers: { 'x-respond-with': 'html', 'x-target-selector': selector },
      signal: controller.signal,
    })
    if (response.status === 429) throw new RelayBusy()
    if (!response.ok) throw new Error(`relay ${response.status}`)
    const html = await response.text()
    cache.set(key, html)
    return html
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Find a player by the name the club knows them under.
 *
 * The terms are tried in turn and the first one that returns anybody wins, because
 * TTTM matches a single word against a single name field — see `searchTerms`. What
 * comes back is the whole family sharing that surname, ordered so the closest match
 * to the name asked for is first; the manager picks, because two people really do
 * share a name and no amount of sorting can choose between them.
 */
export async function searchTttm(name: string): Promise<TttmResult<TttmPlayer[]>> {
  const terms = searchTerms(name)
  if (terms.length === 0) return { kind: 'none' }

  // A term that answered with nobody is a real answer, not a failure: only a search
  // that never reached the site at all should tell the manager to try again.
  let answered = false
  let busy = false

  for (const term of terms) {
    try {
      const found = parseRankingRows(await readFragment(searchPageUrl(term), TABLE_SELECTOR))
      answered = true
      if (found.length > 0) return { kind: 'ok', value: rankMatches(found, name) }
    } catch (error) {
      if (error instanceof RelayBusy) busy = true
    }
  }

  if (answered) return { kind: 'none' }
  return busy ? { kind: 'busy' } : { kind: 'unreachable' }
}

/**
 * Read one player straight off their own page, from a pasted link or a bare id.
 *
 * The way in when the search has nothing to say — a player registered before the
 * season's first ranking list is published is exactly that case, and it is the case
 * a club hits every autumn.
 */
export async function fetchTttmPlayer(input: string): Promise<TttmResult<TttmPlayer>> {
  const tttmId = tttmIdFrom(input)
  if (tttmId === null) return { kind: 'none' }

  const fromSlug = nameFromUrl(input)
  try {
    const player = parsePlayerCard(await readFragment(playerPageUrl(tttmId, fromSlug), CARD_SELECTOR))
    if (!player) return { kind: 'none' }
    // The card's own name is the authority; the slug is what a page that has been
    // rearranged leaves us with.
    return { kind: 'ok', value: { ...player, name: player.name || fromSlug || '' } }
  } catch (error) {
    return { kind: error instanceof RelayBusy ? 'busy' : 'unreachable' }
  }
}

/**
 * Bring a player's photograph back as a data URL the roster can hold.
 *
 * A second relay, and a different kind: TTTM serves the image itself perfectly well,
 * but reading its *bytes* needs CORS just as the page does — an <img> would display
 * and a canvas drawn from it would be tainted, so it could never be stored. weserv is
 * an image CDN that answers with 'Access-Control-Allow-Origin: *' and resizes on the
 * way through, which happens to be the same 320px square readPhoto makes.
 *
 * The same builder serves the thumbnails in the results list, so a manager choosing
 * between two players of one name is not quietly making a request to TTTM from every
 * row while a note underneath says only the search left the device.
 *
 * It still goes through readPhoto rather than being stored as it arrives: that is the
 * one place the app decides how big a stored photo may be, and a relay is not the
 * place to start trusting a remote server's idea of it.
 */
export function photoThumbUrl(src: string, size = 320): string {
  const bare = src.replace(/^https?:\/\//, '')
  return (
    `https://images.weserv.nl/?url=${encodeURIComponent(bare)}` +
    `&w=${size}&h=${size}&fit=cover&output=jpg&q=82`
  )
}

export async function fetchTttmPhoto(src: string): Promise<string | undefined> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(photoThumbUrl(src), { signal: controller.signal })
    if (!response.ok) return undefined
    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) return undefined
    return await readPhoto(blob)
  } catch {
    // A missing photo is a cosmetic loss on top of a rank that arrived fine, so it
    // never fails the lookup that asked for it.
    return undefined
  } finally {
    clearTimeout(timer)
  }
}
