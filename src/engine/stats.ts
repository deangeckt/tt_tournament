import type { PlayerId, Tournament } from './types'
import { resolveLevel } from './resolve'
import { tally } from './result'

/**
 * Career records, derived rather than stored.
 *
 * The same principle as the rest of the engine: nothing about a player's history is
 * written down: it is recomputed from the tournaments themselves, so correcting a
 * score from three months ago corrects the record it produced. That costs a full
 * resolve per level, which at club scale (tens of tournaments) is microseconds.
 */

/** One player's line in one tournament. */
export interface PlayerTournamentRecord {
  tournamentId: string
  tournamentName: string
  /** ISO date, as stored on the tournament. */
  date: string
  levelId: string
  levelName: string
  played: number
  won: number
  lost: number
  gamesFor: number
  gamesAgainst: number
  /** Position in the group table, where the format has one. */
  rank?: number
  champion: boolean
}

export interface PlayerStats {
  playerId: PlayerId
  tournaments: number
  titles: number
  played: number
  won: number
  lost: number
  gamesFor: number
  gamesAgainst: number
  /** Most recent first. */
  history: PlayerTournamentRecord[]
}

const EMPTY = {
  tournaments: 0,
  titles: 0,
  played: 0,
  won: 0,
  lost: 0,
  gamesFor: 0,
  gamesAgainst: 0,
}

/**
 * Walk every tournament this player appears in.
 *
 * Only matches whose stored result still belongs to the two people standing there
 * count — the same `fresh` rule standings use. A result orphaned by a later
 * correction is shown to the manager for repair; it must not quietly inflate
 * somebody's career record.
 */
export function playerStats(
  tournaments: readonly Tournament[],
  playerId: PlayerId,
): PlayerStats {
  const stats: PlayerStats = { playerId, ...EMPTY, history: [] }

  for (const tournament of tournaments) {
    for (const level of tournament.levels) {
      if (!level.playerIds.includes(playerId)) continue

      const view = resolveLevel(level, tournament.results)
      const record: PlayerTournamentRecord = {
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        date: tournament.date,
        levelId: level.id,
        levelName: level.name,
        played: 0,
        won: 0,
        lost: 0,
        gamesFor: 0,
        gamesAgainst: 0,
        champion: view.champion === playerId,
      }

      for (const match of view.matches) {
        if (!match.result || match.staleness !== 'fresh') continue
        const side =
          match.a.kind === 'player' && match.a.playerId === playerId
            ? 'a'
            : match.b.kind === 'player' && match.b.playerId === playerId
              ? 'b'
              : null
        if (!side) continue

        const t = tally(match.result, level.bestOf)
        record.played++
        if (t.winner === side) record.won++
        else if (t.winner !== null) record.lost++
        record.gamesFor += side === 'a' ? t.gamesA : t.gamesB
        record.gamesAgainst += side === 'a' ? t.gamesB : t.gamesA
      }

      const group = view.groups.find((g) => g.playerIds.includes(playerId))
      const row = group
        ? view.standings.get(group.id)?.find((r) => r.playerId === playerId)
        : undefined
      if (row) record.rank = row.rank

      stats.tournaments++
      if (record.champion) stats.titles++
      stats.played += record.played
      stats.won += record.won
      stats.lost += record.lost
      stats.gamesFor += record.gamesFor
      stats.gamesAgainst += record.gamesAgainst
      stats.history.push(record)
    }
  }

  // Newest first, with the tournament's own date deciding rather than insertion
  // order — a tournament entered late for a night last month belongs last month.
  stats.history.sort((a, b) => b.date.localeCompare(a.date))
  return stats
}

/** Head-to-head record between two players across every tournament. */
export function headToHead(
  tournaments: readonly Tournament[],
  playerId: PlayerId,
  opponentId: PlayerId,
): { played: number; won: number; lost: number } {
  let played = 0
  let won = 0
  let lost = 0

  for (const tournament of tournaments) {
    for (const level of tournament.levels) {
      if (!level.playerIds.includes(playerId) || !level.playerIds.includes(opponentId)) continue
      const view = resolveLevel(level, tournament.results)

      for (const match of view.matches) {
        if (!match.result || match.staleness !== 'fresh') continue
        if (match.a.kind !== 'player' || match.b.kind !== 'player') continue
        const ids = [match.a.playerId, match.b.playerId]
        if (!ids.includes(playerId) || !ids.includes(opponentId)) continue

        const t = tally(match.result, level.bestOf)
        played++
        if (t.winner === null) continue
        const winnerId = t.winner === 'a' ? match.a.playerId : match.b.playerId
        if (winnerId === playerId) won++
        else lost++
      }
    }
  }

  return { played, won, lost }
}
