import { create } from 'zustand'
import type { MatchId, MatchResult, Player, PlayerId, Tournament } from '../engine/types'
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
}))
