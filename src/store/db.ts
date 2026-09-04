import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Player, Tournament } from '../engine/types'

interface TTSchema extends DBSchema {
  tournaments: {
    key: string
    value: Tournament
    indexes: { 'by-updated': number }
  }
  roster: {
    key: string
    value: Player
  }
}

let dbPromise: Promise<IDBPDatabase<TTSchema>> | null = null

function db(): Promise<IDBPDatabase<TTSchema>> {
  dbPromise ??= openDB<TTSchema>('tt-tournament', 1, {
    upgrade(database) {
      const tournaments = database.createObjectStore('tournaments', { keyPath: 'id' })
      tournaments.createIndex('by-updated', 'updatedAt')
      database.createObjectStore('roster', { keyPath: 'id' })
    },
  })
  return dbPromise
}

export async function listTournaments(): Promise<Tournament[]> {
  const all = await (await db()).getAllFromIndex('tournaments', 'by-updated')
  return all.reverse()
}

export async function getTournament(id: string): Promise<Tournament | undefined> {
  return (await db()).get('tournaments', id)
}

export async function putTournament(tournament: Tournament): Promise<void> {
  await (await db()).put('tournaments', tournament)
}

export async function deleteTournament(id: string): Promise<void> {
  await (await db()).delete('tournaments', id)
}

export async function listRoster(): Promise<Player[]> {
  const all = await (await db()).getAll('roster')
  // Hebrew needs a locale-aware collator; the default sort compares UTF-16 units.
  return all.sort((a, b) => new Intl.Collator('he').compare(a.name, b.name))
}

export async function putRosterPlayer(player: Player): Promise<void> {
  await (await db()).put('roster', player)
}

export async function deleteRosterPlayer(id: string): Promise<void> {
  await (await db()).delete('roster', id)
}

/**
 * Ask the browser to exempt our data from routine eviction.
 *
 * Safari clears IndexedDB for non-installed sites after a week of no visits, which
 * on a tablet used for a monthly club night means the roster is gone every time.
 * The request is far more likely to be granted once the app is installed.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

/** Wipe both stores. Only reachable from an explicit "replace everything" import. */
export async function clearAllData(): Promise<void> {
  const database = await db()
  await Promise.all([database.clear('tournaments'), database.clear('roster')])
}
