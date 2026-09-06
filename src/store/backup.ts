import type { Player, Tournament } from '../engine/types'
import { clearAllData, putRosterPlayer, putTournament } from './db'

/**
 * Export and import everything, because there is no backend.
 *
 * This is the real cost of storing a club's history in a browser: clearing site data
 * loses it, and a manager who runs the night from a phone one week and a laptop the
 * next has two disjoint histories. A single JSON file is the lightest thing that
 * fixes both — small enough to send over WhatsApp, and readable enough that anyone
 * can see what they are handing over.
 */

export const BACKUP_APP = 'tt-tournament'
export const BACKUP_VERSION = 1

export interface BackupFile {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  roster: Player[]
  tournaments: Tournament[]
}

export type ImportMode = 'merge' | 'replace'

export interface ImportSummary {
  tournaments: number
  players: number
}

export function buildBackup(
  roster: readonly Player[],
  tournaments: readonly Tournament[],
): BackupFile {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    roster: [...roster],
    tournaments: [...tournaments],
  }
}

/** Returns null for a file that is not one of ours, rather than throwing at a user. */
export function parseBackup(text: string): BackupFile | null {
  try {
    const parsed = JSON.parse(text) as Partial<BackupFile>
    if (parsed?.app !== BACKUP_APP) return null
    if (typeof parsed.version !== 'number' || parsed.version > BACKUP_VERSION) return null
    if (!Array.isArray(parsed.roster) || !Array.isArray(parsed.tournaments)) return null
    return {
      app: BACKUP_APP,
      version: parsed.version,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
      roster: parsed.roster.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string'),
      tournaments: parsed.tournaments.filter(
        (t) => t && typeof t.id === 'string' && Array.isArray(t.levels),
      ),
    }
  } catch {
    return null
  }
}

/**
 * Write a backup into local storage.
 *
 * 'merge' is the default because it is the non-destructive one: records are keyed by
 * id, so re-importing a file you already have is a no-op rather than a duplicate.
 */
export async function importBackup(
  backup: BackupFile,
  mode: ImportMode = 'merge',
): Promise<ImportSummary> {
  if (mode === 'replace') await clearAllData()
  for (const player of backup.roster) await putRosterPlayer(player)
  for (const tournament of backup.tournaments) await putTournament(tournament)
  return { tournaments: backup.tournaments.length, players: backup.roster.length }
}

/**
 * Read a chosen file straight into storage, or answer null when it is not ours.
 *
 * Both places that offer an import — the settings screen, and the prompt an empty
 * device shows instead of a roster — go through here, so 'that file is not a backup
 * from this app' is decided once and cannot come to mean two different things.
 */
export async function importFile(
  file: File,
  mode: ImportMode = 'merge',
): Promise<ImportSummary | null> {
  const backup = parseBackup(await file.text())
  return backup ? importBackup(backup, mode) : null
}

/**
 * An import rewrites the database underneath a running app: in 'replace' mode it can
 * pull away the very tournament a screen is holding, and even a merge lands records
 * no open screen asked for. Reloading is the honest way to put every screen back in
 * step with storage, so the confirmation has to outlive the reload — it is parked
 * here on the way out and collected on the way back up.
 */
const IMPORT_NOTICE_KEY = 'tt-import-summary'

export function stashImportSummary(summary: ImportSummary): void {
  try {
    sessionStorage.setItem(IMPORT_NOTICE_KEY, JSON.stringify(summary))
  } catch {
    // Storage blocked: the data still imported, only the confirmation is lost.
  }
}

/** Read the parked confirmation once — a later reload must not show it again. */
export function takeImportSummary(): ImportSummary | null {
  try {
    const raw = sessionStorage.getItem(IMPORT_NOTICE_KEY)
    sessionStorage.removeItem(IMPORT_NOTICE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ImportSummary>
    if (typeof parsed?.tournaments !== 'number' || typeof parsed.players !== 'number') return null
    return { tournaments: parsed.tournaments, players: parsed.players }
  } catch {
    return null
  }
}

export function backupFilename(now = new Date()): string {
  return `tt-tournament-${now.toISOString().slice(0, 10)}.json`
}

/** Hand the browser a file to save. */
export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Revoked on the next tick: revoking synchronously can cancel the download in
  // some browsers before it has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Offer the file to the OS share sheet — which is what puts WhatsApp and email in
 * front of the user — and fall back to a plain download where that is unavailable
 * (every desktop browser but Safari, and any non-secure origin).
 */
export async function shareTextFile(
  filename: string,
  text: string,
  title: string,
): Promise<'shared' | 'downloaded'> {
  try {
    const file = new File([text], filename, { type: 'application/json' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title })
      return 'shared'
    }
  } catch (error) {
    // AbortError means the user closed the share sheet; that is not a failure and
    // must not then dump a file into their downloads folder.
    if (error instanceof DOMException && error.name === 'AbortError') return 'shared'
  }
  downloadText(filename, text)
  return 'downloaded'
}
