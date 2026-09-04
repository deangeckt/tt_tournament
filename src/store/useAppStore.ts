import { create } from 'zustand'
import type { Level, LevelId, MatchId, MatchResult, Player, PlayerId, Tournament } from '../engine/types'
import { buildFixtures } from '../engine/resolve'
import { generateSeed } from '../engine/rng'
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

  addRosterPlayer: (name: string) => Promise<Player | undefined>
  removeRosterPlayer: (id: string) => Promise<void>

  setResult: (matchId: MatchId, result: MatchResult, playedBy: [PlayerId, PlayerId]) => Promise<void>
  clearResult: (matchId: MatchId) => Promise<void>

  /** Edit the tournament's own fields (name, date, score mode, tables). */
  patchTournament: (patch: Partial<Tournament>) => Promise<void>
  /** Edit one level. Changing its players or format re-derives its fixtures. */
  patchLevel: (levelId: LevelId, patch: Partial<Level>) => Promise<void>
  /** Re-run the draw for a level under a fresh seed. */
  redrawLevel: (levelId: LevelId) => Promise<void>
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
      levels: current.levels.map((l) =>
        l.id === levelId ? { ...l, seed: generateSeed() } : l,
      ),
    })
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
