import type { Player, PlayerId, Tournament } from '../engine/types'

/**
 * Taking a shared tournament into this device's own database.
 *
 * The scenario this exists for: the night was run on the club tablet, or on a phone
 * that happened to be charged, and it has to end up in the manager's real history on
 * the device that holds all the others. The share link already carries the whole
 * tournament, so nothing has to be fetched — but a link cannot carry *this* device's
 * idea of who its players are, and that is the whole problem.
 *
 * Player ids are minted per device. The same human entered on two devices is two
 * uuids, and a career record keyed by id would then be two half-records for one
 * person. So an adopted tournament is rewritten against the local roster: players
 * recognised by id or by name take the local id, and everyone else is added to the
 * roster under the id they arrived with.
 *
 * Rewriting ids is safe because no fixture depends on their value. The draw is a
 * seeded shuffle of `playerIds` and match ids come from level/stage/round/order, so
 * a 1:1 rename preserves every match id — which is exactly what keeps the stored
 * results attached to the matches they were entered on.
 */

export interface AdoptPlan {
  /** The tournament rewritten against this device's player ids. */
  tournament: Tournament
  /** Roster entries this device does not have yet, ready to be saved. */
  newPlayers: Player[]
  /** Incoming players recognised as somebody already on the roster. */
  matched: number
  /** True when a tournament with this id is already stored here and will be replaced. */
  replaces: boolean
}

/**
 * Names are matched the way a person would: ignoring case and the double space
 * somebody typed on a phone. Deliberately not fuzzier than that — merging "Dan" into
 * "Dana" would silently hand one player another's record, and the manager can always
 * rename afterwards.
 */
function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function planAdoption(
  incoming: Tournament,
  roster: readonly Player[],
  existing: readonly Tournament[],
): AdoptPlan {
  const byId = new Map(roster.map((p) => [p.id, p]))
  const byName = new Map<string, Player>()
  // First wins: the roster is name-unique in practice, and if it is not, the earlier
  // entry is the one the rest of the history already points at.
  for (const player of roster) {
    const key = nameKey(player.name)
    if (!byName.has(key)) byName.set(key, player)
  }

  // A level carries the ranks it was drawn against, and they are the only record of
  // an incoming stranger's rank: the slim player copies in a share payload have none.
  // Worth keeping, so a player who first appears here arrives with their standard.
  const incomingRank = new Map<PlayerId, number>()
  for (const level of incoming.levels) {
    for (const [playerId, rank] of Object.entries(level.ranks ?? {})) {
      incomingRank.set(playerId, rank)
    }
  }

  const rename = new Map<PlayerId, PlayerId>()
  const localName = new Map<PlayerId, string>()
  const claimed = new Set<PlayerId>()
  const newPlayers: Player[] = []
  let matched = 0

  for (const player of incoming.players) {
    const local = byId.get(player.id) ?? byName.get(nameKey(player.name))
    // A local player can stand in for exactly one incoming player: two people who
    // share a name on the other device must not collapse into one here.
    if (local && !claimed.has(local.id)) {
      claimed.add(local.id)
      rename.set(player.id, local.id)
      // The local spelling wins, so the tournament reads like the rest of the history.
      localName.set(player.id, local.name)
      matched++
      continue
    }
    // Nobody here yet. The incoming id was minted by crypto.randomUUID on the other
    // device, so keeping it collides with nothing and keeps the rewrite a no-op.
    claimed.add(player.id)
    const arrival: Player = { id: player.id, name: player.name.trim() }
    // Only for players this device does not have. A local rank is this manager's own
    // and may well be newer than the snapshot the tournament was drawn against.
    const rank = incomingRank.get(player.id)
    if (rank !== undefined) arrival.rank = rank
    newPlayers.push(arrival)
  }

  const id = (playerId: PlayerId) => rename.get(playerId) ?? playerId

  const tournament: Tournament = {
    ...incoming,
    players: incoming.players.map((player) => ({
      id: id(player.id),
      name: localName.get(player.id) ?? player.name.trim(),
    })),
    levels: incoming.levels.map((level) => ({
      ...level,
      playerIds: level.playerIds.map(id),
      withdrawn: level.withdrawn.map(id),
      manualOrder: level.manualOrder?.map(id),
      // Renamed like everything else, and for the same reason: the draw reads these
      // by player id, so a map still keyed by the sender's ids would draw an
      // unranked field here and move every match out from under its stored result.
      ranks: level.ranks
        ? Object.fromEntries(Object.entries(level.ranks).map(([who, rank]) => [id(who), rank]))
        : undefined,
    })),
    results: Object.fromEntries(
      Object.entries(incoming.results).map(([matchId, stored]) => [
        matchId,
        { ...stored, playedBy: [id(stored.playedBy[0]), id(stored.playedBy[1])] as [PlayerId, PlayerId] },
      ]),
    ),
  }

  return {
    tournament,
    newPlayers,
    matched,
    replaces: existing.some((t) => t.id === incoming.id),
  }
}
