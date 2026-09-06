import type { Level, Player, PlayerId, Tournament } from '../engine/types'
import { buildFixtures } from '../engine/resolve'

/**
 * Deciding which ranking points a level is drawn against.
 *
 * `Level.ranks` is the one piece of source state the app copies rather than derives,
 * because its origin — a player's TTTM points, on the roster record — is outside the
 * tournament and the league revises it weekly. The rules for when that copy may be
 * written are the whole reason this is a module of its own rather than four lines
 * inside the store: they are subtle, they are load-bearing, and they are testable
 * without a database.
 */

/** Today's ranking points for whichever of these players carry one. */
export function rosterRanks(
  playerIds: readonly PlayerId[],
  roster: readonly Player[],
): Record<PlayerId, number> {
  const byId = new Map(roster.map((player) => [player.id, player]))
  const ranks: Record<PlayerId, number> = {}
  for (const id of playerIds) {
    const rank = byId.get(id)?.rank
    if (rank !== undefined) ranks[id] = rank
  }
  return ranks
}

/**
 * The map, or nothing at all when not one player in the level is ranked.
 *
 * Absent rather than empty on purpose: an empty map still says "this level was drawn
 * against ranks", and the engine reads its absence as the plain shuffle a club that
 * has never heard of TTTM should keep getting.
 */
export function ranksOrNone(
  playerIds: readonly PlayerId[],
  roster: readonly Player[],
): Record<PlayerId, number> | undefined {
  const ranks = rosterRanks(playerIds, roster)
  return Object.keys(ranks).length > 0 ? ranks : undefined
}

/**
 * Whether anything has been recorded in this level yet.
 *
 * Counts *stored* results rather than fresh ones, the same way removeLevel does: a
 * level holding nothing but flagged results looks unplayed to `view.played`, and it is
 * precisely the level where moving the draw again would do the most damage.
 */
export function hasStoredResults(level: Level, results: Tournament['results']): boolean {
  const ids = new Set(buildFixtures(level).matches.map((match) => match.id))
  return Object.keys(results).some((id) => ids.has(id))
}

/**
 * Fill in the rank of anyone who has joined the level since it was drawn.
 *
 * Two refusals, and each one is a bug that would otherwise be found the hard way.
 *
 * A level carrying no ranks at all is never retro-fitted. Every tournament drawn before
 * ranks existed is such a level, and switching one on underneath would band a draw that
 * people are already playing. Drawing again is the way in, and it says what it costs.
 *
 * Nothing is topped up once a result has been stored. Ranks arrive at all sorts of
 * moments — a manager looks one up on Tuesday for a tournament drawn on Monday — and
 * adding a number to a level that has been played re-sorts the band order under results
 * already keyed to the seats the old order produced. Every one of them would come back
 * flagged, from an edit as unrelated as marking somebody withdrawn. That is the exact
 * failure freezing the ranks exists to prevent, so the freeze has to hold against this
 * too. Before the first result there is nothing to detach and a redraw is free, so a
 * latecomer taking their proper place is worth having.
 *
 * Numbers already on the level are never overwritten either way: that is the freeze
 * itself, and it is what leaves January's bracket alone when a rank is corrected in
 * March.
 */
export function toppedUpRanks(
  next: Level,
  before: Level,
  roster: readonly Player[],
  results: Tournament['results'],
): Level {
  if (!next.ranks) return next
  if (hasStoredResults(before, results)) return next

  const inLevel = new Set(next.playerIds)
  const ranks = { ...rosterRanks(next.playerIds, roster), ...next.ranks }
  return {
    ...next,
    ranks: Object.fromEntries(Object.entries(ranks).filter(([id]) => inLevel.has(id))),
  }
}
