import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { Tournament } from '../engine/types'

/**
 * A whole tournament, small enough to ride in a URL fragment.
 *
 * Everything is derived from { players, config, seed, results }, so a share link
 * carries no bracket, no standings and no group assignments — the recipient's copy
 * of the engine rebuilds all of it. Compressed, a 24-player night is a couple of
 * kilobytes.
 *
 * The payload sits after '#', which browsers never send to the server. On GitHub
 * Pages that is a real privacy property and not an accident: nobody's club roster
 * ends up in an access log.
 */

export const SHARE_VERSION = 1

interface SharePayload {
  v: number
  t: Tournament
}

/**
 * Most browsers cope with far more, but Safari has historically truncated very long
 * URLs, and a link people paste into WhatsApp should not be a gamble.
 */
export const SAFE_URL_LENGTH = 8000

/** Drop anything the recipient neither needs nor should receive. */
export function slimForSharing(tournament: Tournament): Tournament {
  return {
    ...tournament,
    // Photos are roster-local and would multiply the payload by a hundred.
    players: tournament.players.map(({ id, name }) => ({ id, name })),
  }
}

export function encodeTournament(tournament: Tournament): string {
  const payload: SharePayload = { v: SHARE_VERSION, t: slimForSharing(tournament) }
  return compressToEncodedURIComponent(JSON.stringify(payload))
}

/** Returns null for anything that is not a payload this version understands. */
export function decodeTournament(encoded: string): Tournament | null {
  try {
    const json = decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    const payload = JSON.parse(json) as Partial<SharePayload>
    if (payload.v !== SHARE_VERSION) return null
    const tournament = payload.t
    if (!tournament || typeof tournament !== 'object') return null
    if (!Array.isArray(tournament.levels) || !Array.isArray(tournament.players)) return null
    if (typeof tournament.id !== 'string' || typeof tournament.name !== 'string') return null
    return { ...tournament, results: tournament.results ?? {} }
  } catch {
    return null
  }
}

/**
 * An absolute link to the read-only view.
 *
 * Built from the document's own location so it keeps working under any repo name,
 * a custom domain or a local dev server — the same reason vite's base is relative.
 */
export function shareUrl(tournament: Tournament, base = window.location.href): string {
  const root = base.split('#')[0]
  return `${root}#/v/${encodeTournament(tournament)}`
}
