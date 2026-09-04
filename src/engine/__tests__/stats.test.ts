import { describe, expect, it } from 'vitest'
import { headToHead, playerStats } from '../stats'
import { resolveLevel } from '../resolve'
import type { Level, MatchId, StoredResult, Tournament } from '../types'

function level(overrides: Partial<Level> = {}): Level {
  return {
    id: 'L1',
    name: 'A',
    playerIds: ['p1', 'p2', 'p3', 'p4'],
    config: { format: 'roundRobin' },
    bestOf: 5,
    seed: 'SEED1234',
    withdrawn: [],
    ...overrides,
  }
}

function tournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1',
    name: 'Club night',
    date: '2026-01-10',
    scoreMode: 'quick',
    tableCount: 2,
    levels: [level()],
    players: ['p1', 'p2', 'p3', 'p4'].map((id) => ({ id, name: id.toUpperCase() })),
    results: {},
    tableAssignments: {},
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

/** Play every match, always awarding the winner named by `pick`. */
function playAll(base: Tournament, pick: (a: string, b: string) => string): Tournament {
  const results: Record<MatchId, StoredResult> = {}
  let view = resolveLevel(base.levels[0], results, base.scoreMode)
  for (let guard = 0; guard < 100; guard++) {
    const next = view.matches.find((m) => m.playable && !m.result)
    if (!next || next.a.kind !== 'player' || next.b.kind !== 'player') break
    const a = next.a.playerId
    const b = next.b.playerId
    const winnerIsA = pick(a, b) === a
    results[next.match.id] = {
      result: { kind: 'quick', a: winnerIsA ? 3 : 1, b: winnerIsA ? 1 : 3 },
      playedBy: [a, b],
      enteredAt: 0,
    }
    view = resolveLevel(base.levels[0], results, base.scoreMode)
  }
  return { ...base, results }
}

describe('player stats', () => {
  it('is empty for someone who has never entered', () => {
    const stats = playerStats([tournament()], 'stranger')
    expect(stats).toMatchObject({ tournaments: 0, played: 0, won: 0, titles: 0 })
    expect(stats.history).toEqual([])
  })

  it('counts a full round robin from the tournament itself', () => {
    // p1 beats everyone; the rest are decided by name order.
    const played = playAll(tournament(), (a, b) => (a === 'p1' || b === 'p1' ? 'p1' : a))
    const stats = playerStats([played], 'p1')

    expect(stats.tournaments).toBe(1)
    expect(stats.played).toBe(3)
    expect(stats.won).toBe(3)
    expect(stats.lost).toBe(0)
    expect(stats.gamesFor).toBe(9)
    expect(stats.gamesAgainst).toBe(3)
    expect(stats.titles).toBe(1)
    expect(stats.history[0]).toMatchObject({ rank: 1, champion: true })
  })

  it('gives the loser of every match a record too', () => {
    const played = playAll(tournament(), (a, b) => (a === 'p1' || b === 'p1' ? 'p1' : a))
    const stats = playerStats([played], 'p2')
    expect(stats.played).toBe(3)
    expect(stats.won + stats.lost).toBe(3)
    expect(stats.titles).toBe(0)
  })

  it('ignores a result that no longer belongs to the players in the match', () => {
    const played = playAll(tournament(), (a) => a)
    const [firstId] = Object.keys(played.results)
    const orphaned: Tournament = {
      ...played,
      results: {
        ...played.results,
        // The same match, recorded for two people who are not in it any more.
        [firstId]: { ...played.results[firstId], playedBy: ['ghost1', 'ghost2'] },
      },
    }

    const before = playerStats([played], 'p1').played + playerStats([played], 'p2').played
    const after = playerStats([orphaned], 'p1').played + playerStats([orphaned], 'p2').played
    expect(after).toBeLessThan(before)
  })

  it('orders history by the tournament date, newest first', () => {
    const january = playAll(tournament({ id: 'a', date: '2026-01-10' }), (x) => x)
    const march = playAll(tournament({ id: 'b', date: '2026-03-02' }), (x) => x)
    const stats = playerStats([january, march], 'p1')
    expect(stats.history.map((h) => h.date)).toEqual(['2026-03-02', '2026-01-10'])
    expect(stats.tournaments).toBe(2)
  })
})

describe('head to head', () => {
  it('adds up to the number of times two players met', () => {
    const played = playAll(tournament(), (a, b) => (a === 'p1' || b === 'p1' ? 'p1' : a))
    const record = headToHead([played], 'p1', 'p2')
    expect(record.played).toBe(1)
    expect(record.won).toBe(1)
    expect(record.lost).toBe(0)
    // And it reads the same from the other side.
    expect(headToHead([played], 'p2', 'p1')).toEqual({ played: 1, won: 0, lost: 1 })
  })

  it('is empty for two players who were never in the same level', () => {
    const played = playAll(tournament(), (x) => x)
    expect(headToHead([played], 'p1', 'stranger')).toEqual({ played: 0, won: 0, lost: 0 })
  })
})
