import { create } from 'zustand'
import type {
  FormatConfig,
  Level,
  LevelId,
  MatchId,
  MatchResult,
  Player,
  PlayerId,
  Tournament,
} from '../engine/types'
import { buildFixtures } from '../engine/resolve'
import { generateSeed } from '../engine/rng'
import type { AdoptPlan } from '../share/adopt'
import {
  deleteRosterPlayer,
  deleteTournament,
  getTournament,
  listRoster,
  listTournaments,
  putRosterPlayer,
  putTournament,
} from './db'

export function newId(): string {
  return crypto.randomUUID()
}

interface AppState {
  tournaments: Tournament[]
  roster: Player[]
  current?: Tournament
  loaded: boolean

  load: () => Promise<void>
  openTournament: (id: string) => Promise<void>
  saveTournament: (tournament: Tournament) => Promise<void>
  removeTournament: (id: string) => Promise<void>
  /** Put a tournament back exactly as it was, for the delete and adopt toasts' undo. */
  restoreTournament: (tournament: Tournament) => Promise<void>
  /**
   * Take a shared tournament into this device's database, roster and all.
   *
   * Returns the copy it replaced, if there was one, so the toast can offer it back.
   */
  adoptTournament: (plan: AdoptPlan) => Promise<Tournament | undefined>

  addRosterPlayer: (name: string) => Promise<Player | undefined>
  removeRosterPlayer: (id: string) => Promise<void>
  /** Rename a saved player, or attach/remove their photo. */
  patchRosterPlayer: (id: PlayerId, patch: Partial<Omit<Player, 'id'>>) => Promise<void>

  setResult: (matchId: MatchId, result: MatchResult, playedBy: [PlayerId, PlayerId]) => Promise<void>
  clearResult: (matchId: MatchId) => Promise<void>

  /** Edit the tournament's own fields (name, date, score mode, tables). */
  patchTournament: (patch: Partial<Tournament>) => Promise<void>
  /** Edit one level. Changing its players or format re-derives its fixtures. */
  patchLevel: (levelId: LevelId, patch: Partial<Level>) => Promise<void>
  /**
   * Change a level's format, dropping the results whose matches it no longer has.
   *
   * A result keyed by a match id the new fixtures never generate would sit in the map
   * forever, invisible and uncorrectable, so it goes with the match it belonged to.
   * Ids the two shapes share keep their results — resolve.ts still checks each one
   * against whoever now stands there.
   */
  setLevelConfig: (levelId: LevelId, config: FormatConfig) => Promise<void>
  /** Add a level to a running tournament. */
  addLevel: (level: Level) => Promise<void>
  /** Remove a level, and with it every result recorded in it. */
  removeLevel: (levelId: LevelId) => Promise<void>
  /** Put a removed level back where it was, for the undo toast. */
  restoreLevel: (level: Level, index: number) => Promise<void>
  /** Move one player from one level to another. */
  movePlayer: (playerId: PlayerId, fromLevelId: LevelId, toLevelId: LevelId) => Promise<void>
  /** Re-run the draw for a level under a fresh seed. */
  redrawLevel: (levelId: LevelId) => Promise<void>
  /** Replace the seeded draw order with one the manager arranged by hand. */
  setDrawOrder: (levelId: LevelId, order: PlayerId[]) => Promise<void>
  /** Hand the draw back to the seed. */
  clearDrawOrder: (levelId: LevelId) => Promise<void>
  /** Mark a player as withdrawn, or bring them back. */
  toggleWithdrawn: (levelId: LevelId, playerId: PlayerId) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  tournaments: [],
  roster: [],
  loaded: false,

  async load() {
    const [tournaments, roster] = await Promise.all([listTournaments(), listRoster()])
    set({ tournaments, roster, loaded: true })
  },

  async openTournament(id) {
    const current = await getTournament(id)
    set({ current })
  },

  async saveTournament(tournament) {
    const stamped = { ...tournament, updatedAt: Date.now() }
    await putTournament(stamped)
    set({ current: stamped, tournaments: await listTournaments() })
  },

  async removeTournament(id) {
    await deleteTournament(id)
    const current = get().current?.id === id ? undefined : get().current
    set({ current, tournaments: await listTournaments() })
  },

  async restoreTournament(tournament) {
    // Deliberately not saveTournament: that stamps updatedAt, which would shuffle a
    // restored tournament to the top of a list ordered by recency. Undo should leave
    // no trace.
    await putTournament(tournament)
    const current = get().current?.id === tournament.id ? tournament : get().current
    set({ current, tournaments: await listTournaments() })
  },

  async adoptTournament(plan) {
    // Read before writing: this is the copy undo puts back when the manager was
    // replacing a tournament they had already started here.
    const previous = plan.replaces ? await getTournament(plan.tournament.id) : undefined
    for (const player of plan.newPlayers) await putRosterPlayer(player)
    // Stamped, unlike a restore: it really did just arrive on this device, and
    // belongs at the top of a list ordered by recency.
    await get().saveTournament(plan.tournament)
    set({ roster: await listRoster() })
    return previous
  },

  async addRosterPlayer(name) {
    const trimmed = name.trim()
    if (!trimmed) return undefined
    const existing = get().roster.find((p) => p.name === trimmed)
    if (existing) return existing

    const player: Player = { id: newId(), name: trimmed }
    await putRosterPlayer(player)
    set({ roster: await listRoster() })
    return player
  },

  async removeRosterPlayer(id) {
    await deleteRosterPlayer(id)
    set({ roster: await listRoster() })
  },

  async patchRosterPlayer(id, patch) {
    const player = get().roster.find((p) => p.id === id)
    if (!player) return
    const updated = { ...player, ...patch }
    await putRosterPlayer(updated)

    // A tournament keeps its own slim {id,name} copies, so a rename that stopped at
    // the roster would leave every night this player ever played — and the standings,
    // share links, printouts and career history drawn from them — still showing the
    // old name. Only the name travels: photos stay roster-only, which is what keeps a
    // share payload inside a URL.
    const touched =
      updated.name === player.name
        ? []
        : (await listTournaments()).filter((tournament) =>
            tournament.players.some((p) => p.id === id),
          )
    for (const tournament of touched) {
      // Deliberately not saveTournament: that stamps updatedAt, which would shuffle
      // every tournament this player ever played to the top of a list ordered by
      // recency. Correcting a spelling is not activity.
      await putTournament({
        ...tournament,
        players: tournament.players.map((p) => (p.id === id ? { ...p, name: updated.name } : p)),
      })
    }

    set({ roster: await listRoster() })
    if (touched.length > 0) {
      const tournaments = await listTournaments()
      const current = get().current
      set({
        tournaments,
        current: current ? (tournaments.find((t) => t.id === current.id) ?? current) : undefined,
      })
    }
  },

  async setResult(matchId, result, playedBy) {
    const current = get().current
    if (!current) return
    await get().saveTournament({
      ...current,
      results: { ...current.results, [matchId]: { result, playedBy, enteredAt: Date.now() } },
    })
  },

  async clearResult(matchId) {
    const current = get().current
    if (!current) return
    const results = { ...current.results }
    delete results[matchId]
    await get().saveTournament({ ...current, results })
  },

  async patchTournament(patch) {
    const current = get().current
    if (!current) return
    await get().saveTournament({ ...current, ...patch })
  },

  async patchLevel(levelId, patch) {
    const current = get().current
    if (!current) return
    await get().saveTournament({
      ...current,
      levels: current.levels.map((level) =>
        level.id === levelId ? { ...level, ...patch } : level,
      ),
    })
  },

  async setLevelConfig(levelId, config) {
    const current = get().current
    if (!current) return
    const level = current.levels.find((l) => l.id === levelId)
    if (!level) return

    const kept = new Set(buildFixtures({ ...level, config }).matches.map((m) => m.id))
    const orphaned = buildFixtures(level)
      .matches.map((m) => m.id)
      .filter((id) => !kept.has(id))
    const drop = new Set(orphaned)

    await get().saveTournament({
      ...current,
      results: Object.fromEntries(
        Object.entries(current.results).filter(([id]) => !drop.has(id)),
      ),
      levels: current.levels.map((l) => (l.id === levelId ? { ...l, config } : l)),
    })
  },

  async addLevel(level) {
    const current = get().current
    if (!current) return
    await get().saveTournament({ ...current, levels: [...current.levels, level] })
  },

  async removeLevel(levelId) {
    const current = get().current
    if (!current || current.levels.length < 2) return
    const level = current.levels.find((l) => l.id === levelId)
    if (!level) return

    const gone = new Set(buildFixtures(level).matches.map((m) => m.id))
    await get().saveTournament({
      ...current,
      results: Object.fromEntries(
        Object.entries(current.results).filter(([id]) => !gone.has(id)),
      ),
      levels: current.levels.filter((l) => l.id !== levelId),
    })
  },

  async restoreLevel(level, index) {
    const current = get().current
    if (!current) return
    const levels = current.levels.filter((l) => l.id !== level.id)
    levels.splice(index, 0, level)
    await get().saveTournament({ ...current, levels })
  },

  async movePlayer(playerId, fromLevelId, toLevelId) {
    const current = get().current
    if (!current || fromLevelId === toLevelId) return
    await get().saveTournament({
      ...current,
      // Both levels re-derive from their player lists, so the move needs no other
      // bookkeeping: a hand-made order drops the departed id on its own, and any
      // result they left behind is flagged rather than reassigned.
      levels: current.levels.map((level) => {
        if (level.id === fromLevelId) {
          return {
            ...level,
            playerIds: level.playerIds.filter((id) => id !== playerId),
            withdrawn: level.withdrawn.filter((id) => id !== playerId),
          }
        }
        if (level.id === toLevelId && !level.playerIds.includes(playerId)) {
          return { ...level, playerIds: [...level.playerIds, playerId] }
        }
        return level
      }),
    })
  },

  async redrawLevel(levelId) {
    const current = get().current
    if (!current) return
    const level = current.levels.find((l) => l.id === levelId)
    if (!level) return

    // Results are keyed by match id, and a new seed produces a different fixture
    // graph, so any result belonging to this level would attach to the wrong match.
    // Drop them rather than leave them dangling.
    const stale = new Set(buildFixtures(level).matches.map((m) => m.id))
    const results = Object.fromEntries(
      Object.entries(current.results).filter(([id]) => !stale.has(id)),
    )

    await get().saveTournament({
      ...current,
      results,
      // A fresh seed with a hand-made order still on it would change nothing, so
      // "draw again" also means "forget my arrangement".
      levels: current.levels.map((l) =>
        l.id === levelId ? { ...l, seed: generateSeed(), manualOrder: undefined } : l,
      ),
    })
  },

  async setDrawOrder(levelId, order) {
    await get().patchLevel(levelId, { manualOrder: order })
  },

  async clearDrawOrder(levelId) {
    await get().patchLevel(levelId, { manualOrder: undefined })
  },

  async toggleWithdrawn(levelId, playerId) {
    const current = get().current
    if (!current) return
    const level = current.levels.find((l) => l.id === levelId)
    if (!level) return
    const withdrawn = level.withdrawn.includes(playerId)
      ? level.withdrawn.filter((id) => id !== playerId)
      : [...level.withdrawn, playerId]
    await get().patchLevel(levelId, { withdrawn })
  },
}))
