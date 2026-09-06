/**
 * Reading a player's standard off tttm.co.il.
 *
 * The Israeli league publishes every player's ranking points on a public page, and a
 * club manager already knows them by name. This turns that into a number the draw can
 * use, without asking anyone to copy digits off a phone.
 *
 * Everything here is pure: URLs in, text in, records out. The fetching — which is the
 * part with a third party in it — lives in lookup.ts, and the reason the two are
 * split is that these parsers are the half worth testing, and testing them needs no
 * network and no DOM.
 *
 * Parsed with regular expressions rather than DOMParser on purpose. The input is a
 * fragment we asked for by selector, so it is small and predictable; regex keeps this
 * module runnable under the plain node test environment the rest of the engine uses,
 * instead of pulling jsdom in for one file.
 */

export const TTTM_ORIGIN = 'https://www.tttm.co.il'

export interface TttmPlayer {
  tttmId: number
  name: string
  /** Ranking points, e.g. 1747.6. A registered player with no results yet is 0. */
  rank: number
  club?: string
  /** Age and sex band as TTTM writes it: S, S50, J18, C15. */
  category?: string
  /** Absolute URL of their photograph, absent when the site is showing its avatar. */
  photo?: string
  /** Their position on the national list, when they have one. */
  position?: number
}

/**
 * The player's page.
 *
 * The slug is decorative — /p/676/anything serves the same page — but a real name in
 * it makes the link readable when it is shown to the manager or opened in a tab.
 */
export function playerPageUrl(tttmId: number, name?: string): string {
  const slug = name?.trim() ? encodeURIComponent(name.trim().replace(/\s+/g, '-')) : 'p'
  return `${TTTM_ORIGIN}/p/${tttmId}/${slug}`
}

/**
 * The site's own search, which is a GET even though the form posts.
 *
 * It answers with the ranking table filtered to matching players — the same columns,
 * so one parser reads both.
 */
export function searchPageUrl(term: string): string {
  return `${TTTM_ORIGIN}/?page=rank&search=${encodeURIComponent(term)}`
}

/**
 * The terms to try for a person's name, best first.
 *
 * TTTM's search matches one word against one name field, so a full "עמית גורן" finds
 * nobody at all while "גורן" finds every Goren on the list. That single behaviour is
 * most of why a manager concludes their player is not in the database — so the full
 * string is not even attempted when it has a space in it, and the surname goes first
 * because it is the more selective half of an Israeli name.
 */
export function searchTerms(name: string): string[] {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length <= 1) return words
  return [...new Set(words.reverse())]
}

/** The numeric id out of a pasted link, a bare /p/ path, or the number by itself. */
export function tttmIdFrom(input: string): number | null {
  const trimmed = input.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  // Ids sometimes carry a suffix in the wild — /p/676-a-1/… — so the digits stop at
  // the first thing that is not one.
  const match = /\/p\/(\d+)/.exec(trimmed)
  return match ? Number(match[1]) : null
}

/**
 * The name out of a pasted link's slug.
 *
 * Worth having because the player page itself is the one place the name is hard to
 * pin down, and a link the manager copied usually carries it: /p/676/עמית-גורן.
 */
export function nameFromUrl(input: string): string | undefined {
  const match = /\/p\/\d+[^/]*\/([^/?#]+)/.exec(input.trim())
  if (!match) return undefined
  try {
    const slug = decodeURIComponent(match[1]).replace(/-/g, ' ').trim()
    // 'p' is the placeholder playerPageUrl writes when it has no name to put there.
    return slug && slug !== 'p' && !/^\d+$/.test(slug) ? slug : undefined
  } catch {
    return undefined
  }
}

/** Compare names the way a person would: ignoring case and stray whitespace. */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function absolute(src: string): string {
  return src.startsWith('http') ? src : `${TTTM_ORIGIN}${src.startsWith('/') ? '' : '/'}${src}`
}

/**
 * The photograph in a fragment, if there is one.
 *
 * A player with no picture is served the site's own silhouette from /img/, which is
 * worse than the initials the app already draws — so only a real upload counts.
 */
function photoIn(html: string): string | undefined {
  for (const match of html.matchAll(/<img[^>]*\ssrc=["']([^"']+)["']/gi)) {
    if (match[1].includes('/playerPict/')) return absolute(match[1])
  }
  return undefined
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

/** "1747.6 (1680.2)" — the live figure, then where the player started the season. */
function pointsIn(text: string): number | undefined {
  const match = /(\d+(?:\.\d+)?)\s*\(\s*\d+(?:\.\d+)?\s*\)/.exec(text)
  return match ? Number(match[1]) : undefined
}

/**
 * Rows out of the ranking table, which is what a search answers with.
 *
 * Cells are found by what they hold rather than by their position, so a column added
 * to the left of them costs nothing: the id and the name come from the one link to a
 * player page, the club and the category from their own classes, and the points from
 * the one cell shaped like "1747.6 (1747.6)".
 */
export function parseRankingRows(html: string): TttmPlayer[] {
  const players: TttmPlayer[] = []
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = row[1]
    const link = /<a[^>]*\shref=["']\/p\/(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i.exec(cells)
    if (!link) continue

    const name = stripTags(link[2])
    if (!name) continue

    const player: TttmPlayer = {
      tttmId: Number(link[1]),
      name,
      rank: pointsIn(stripTags(cells)) ?? 0,
    }

    const club = /<td[^>]*class=["'][^"']*\bclub\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/i.exec(cells)
    if (club) {
      const text = stripTags(club[1])
      // "ללא מועדון" — unattached. Recording it as a club would print a phrase where
      // a club name goes.
      if (text && text !== 'ללא מועדון') player.club = text
    }

    const category = /<td[^>]*>\s*([A-Z]{1,3}\d{0,2})\s*<\/td>/.exec(cells)
    if (category) player.category = category[1]

    const position = /<td[^>]*class=["'][^"']*\brk\b[^"']*["'][^>]*>\s*(\d+)\s*<\/td>/i.exec(cells)
    if (position) player.position = Number(position[1])

    const photo = photoIn(cells)
    if (photo) player.photo = photo

    players.push(player)
  }
  return players
}

/**
 * The card at the top of a player's own page.
 *
 * The one path that reaches a player the search cannot: a manager who was handed a
 * link, or whose player is registered but not yet on a ranking list.
 */
export function parsePlayerCard(html: string): TttmPlayer | null {
  const text = stripTags(html)

  const rank = /נקודות\s*:\s*(\d+(?:\.\d+)?)/.exec(text)
  const id = /ID\s*של\s*השחקן\s*:\s*(\d+)/.exec(text)
  if (!rank || !id) return null

  const named = /class=["'][^"']*\bplayerName\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html)
  const player: TttmPlayer = {
    tttmId: Number(id[1]),
    name: named ? stripTags(named[1]) : '',
    rank: Number(rank[1]),
  }

  const category = /קטגוריה\s*:\s*([A-Za-z]{1,3}\d{0,2})/.exec(text)
  if (category) player.category = category[1]

  const club = /<a[^>]*\shref=["']\/c\/\d+[^"']*["'][^>]*>([\s\S]*?)<\/a>/i.exec(html)
  if (club) {
    const name = stripTags(club[1])
    if (name && name !== 'ללא מועדון') player.club = name
  }

  const photo = photoIn(html)
  if (photo) player.photo = photo

  return player
}

/**
 * Put the likeliest person first.
 *
 * A surname search comes back with the whole family, so the roster's own spelling
 * decides the order: an exact match, then anyone whose name contains every word of
 * it, then the rest — never a filter, because the reason the manager is here may be
 * that the two spellings differ.
 *
 * Points break the tie inside each tier, and they earn their place: two people really
 * do share a name, and searching "גורן" returns two players called עמית גורן — one on
 * 1747.6 with a club, one on 0.0 with none. TTTM lists the unranked one first, and a
 * list that offered him first would be offering the wrong man at the top every time.
 * Somebody with points has played league matches, which is what makes them the one a
 * club manager is looking for.
 */
export function rankMatches(players: readonly TttmPlayer[], wanted: string): TttmPlayer[] {
  const target = nameKey(wanted)
  const words = target.split(' ').filter(Boolean)

  const score = (player: TttmPlayer): number => {
    const key = nameKey(player.name)
    if (key === target) return 0
    if (words.length > 0 && words.every((word) => key.includes(word))) return 1
    return 2
  }

  return [...players]
    .map((player, index) => ({ player, index, score: score(player) }))
    // Index last, so two players alike on both counts keep the order they arrived in
    // and the sort stays predictable.
    .sort((a, b) => a.score - b.score || b.player.rank - a.player.rank || a.index - b.index)
    .map((entry) => entry.player)
}
