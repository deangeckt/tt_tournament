import { describe, expect, it } from 'vitest'
import {
  SAFE_URL_LENGTH,
  decodeTournament,
  encodeTournament,
  shareUrl,
  slimForSharing,
} from './payload'
import { buildFixtures } from '../engine/resolve'
import { parseBackup, buildBackup, BACKUP_APP } from '../store/backup'
import type { Level, Tournament } from '../engine/types'

function tournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1',
    name: 'ערב מועדון',
    date: '2026-02-14',
    scoreMode: 'quick',
    tableCount: 3,
    levels: [
      {
        id: 'L1',
        name: 'א׳',
        playerIds: ['p1', 'p2', 'p3', 'p4'],
        config: { format: 'groupsKnockout', groupCount: 2, advancePerGroup: 2 },
        bestOf: 5,
        seed: 'SEED1234',
        withdrawn: [],
      },
    ],
    players: [
      { id: 'p1', name: 'דנה' },
      { id: 'p2', name: 'Ben' },
      { id: 'p3', name: 'יואב' },
      { id: 'p4', name: 'Chen' },
    ],
    results: {
      'L1:g0:r0:m0': {
        result: { kind: 'quick', a: 3, b: 1 },
        playedBy: ['p1', 'p2'],
        enteredAt: 1,
      },
    },
    tableAssignments: {},
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  }
}

describe('share payload', () => {
  it('survives a round trip, Hebrew names and all', () => {
    const original = tournament()
    const back = decodeTournament(encodeTournament(original))
    expect(back).toEqual(original)
  })

  it('leaves photos behind', () => {
    const withPhotos = tournament({
      players: [{ id: 'p1', name: 'דנה', photo: 'data:image/jpeg;base64,AAAA' }],
    })
    expect(slimForSharing(withPhotos).players[0].photo).toBeUndefined()
    expect(decodeTournament(encodeTournament(withPhotos))?.players[0].photo).toBeUndefined()
  })

  it('keeps a real club night inside a link', () => {
    // 24 players in four groups, every group match played — a full Tuesday evening,
    // and the size that decides whether links are usable at all.
    const level: Level = {
      id: 'L1',
      name: 'א׳',
      playerIds: Array.from({ length: 24 }, (_, i) => `p${i + 1}`),
      config: { format: 'groupsKnockout', groupCount: 4, advancePerGroup: 2 },
      bestOf: 5,
      seed: 'SEED1234',
      withdrawn: [],
    }
    const results: Tournament['results'] = {}
    for (const match of buildFixtures(level).matches) {
      if (match.a.kind !== 'player' || match.b.kind !== 'player') continue
      results[match.id] = {
        result: { kind: 'detailed', games: [{ a: 11, b: 9 }, { a: 8, b: 11 }, { a: 11, b: 7 }] },
        playedBy: [match.a.playerId, match.b.playerId],
        enteredAt: 1700000000000,
      }
    }

    const big = tournament({
      levels: [level],
      players: level.playerIds.map((id, i) => ({ id, name: `שחקן ${i + 1}` })),
      results,
    })
    const encoded = encodeTournament(big)

    expect(Object.keys(results).length).toBeGreaterThan(50)
    expect(encoded.length).toBeLessThan(JSON.stringify(big).length / 3)
    expect(shareUrl(big, 'https://club.example/tt/').length).toBeLessThan(SAFE_URL_LENGTH)
    expect(decodeTournament(encoded)).toEqual(big)
  })

  it('uses only characters that survive a url fragment', () => {
    expect(encodeTournament(tournament())).toMatch(/^[A-Za-z0-9+\-$]*$/)
  })

  it('returns null rather than throwing on anything else', () => {
    expect(decodeTournament('')).toBeNull()
    expect(decodeTournament('not-a-payload')).toBeNull()
    expect(decodeTournament('%%%')).toBeNull()
  })

  it('rejects a payload from a version it does not understand', () => {
    const encoded = encodeTournament(tournament())
    // A truncated link is the realistic failure — chat apps cut long urls.
    expect(decodeTournament(encoded.slice(0, encoded.length - 12))).toBeNull()
  })

  it('builds a link against the document root, not the current route', () => {
    const url = shareUrl(tournament(), 'https://club.example/tt/#/t/t1')
    expect(url.startsWith('https://club.example/tt/#/v/')).toBe(true)
  })
})

describe('backup files', () => {
  it('round trips through json', () => {
    const backup = buildBackup([{ id: 'p1', name: 'דנה' }], [tournament()])
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed?.app).toBe(BACKUP_APP)
    expect(parsed?.tournaments).toHaveLength(1)
    expect(parsed?.roster).toHaveLength(1)
  })

  it('turns away files that are not ours', () => {
    expect(parseBackup('{}')).toBeNull()
    expect(parseBackup('nonsense')).toBeNull()
    expect(parseBackup(JSON.stringify({ app: 'something-else', version: 1 }))).toBeNull()
  })

  it('turns away a backup written by a newer version', () => {
    const backup = { ...buildBackup([], []), version: 99 }
    expect(parseBackup(JSON.stringify(backup))).toBeNull()
  })

  it('drops entries that are missing the fields everything else assumes', () => {
    const backup = {
      ...buildBackup([], []),
      roster: [{ id: 'p1', name: 'דנה' }, { name: 'no id' }, null],
      tournaments: [tournament(), { id: 'broken' }],
    }
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed?.roster).toHaveLength(1)
    expect(parsed?.tournaments).toHaveLength(1)
  })
})
