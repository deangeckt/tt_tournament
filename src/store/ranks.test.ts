import { describe, expect, it } from 'vitest'
import { hasStoredResults, ranksOrNone, rosterRanks, toppedUpRanks } from './ranks'
import { buildFixtures, levelDrawOrder } from '../engine/resolve'
import type { Level, Player, Tournament } from '../engine/types'

const roster: Player[] = [
  { id: 'a', name: 'דנה', rank: 1600 },
  { id: 'b', name: 'יואב', rank: 1550 },
  { id: 'c', name: 'נועה', rank: 1100 },
  { id: 'd', name: 'איתי' },
  { id: 'e', name: 'רון', rank: 900 },
]

function makeLevel(overrides: Partial<Level> = {}): Level {
  return {
    id: 'L1',
    name: 'א׳',
    playerIds: ['a', 'b', 'c'],
    config: { format: 'roundRobin' },
    bestOf: 5,
    seed: 'SEED1234',
    withdrawn: [],
    ranks: { a: 1600, b: 1550, c: 1100 },
    ...overrides,
  }
}

/** A result on the level's first match, however that match happens to be numbered. */
function playedIn(level: Level): Tournament['results'] {
  const first = buildFixtures(level).matches[0]
  return {
    [first.id]: {
      result: { kind: 'quick', a: 3, b: 0 },
      playedBy: ['a', 'b'],
      enteredAt: 1,
    },
  }
}

describe('rosterRanks', () => {
  it('takes the number only from players who have one', () => {
    expect(rosterRanks(['a', 'd', 'e'], roster)).toEqual({ a: 1600, e: 900 })
  })

  it('ignores ids the roster does not know', () => {
    expect(rosterRanks(['a', 'ghost'], roster)).toEqual({ a: 1600 })
  })
})

describe('ranksOrNone', () => {
  it('is undefined when nobody in the level is ranked', () => {
    // Not an empty map: the engine reads absence as the plain shuffle every club that
    // has never heard of TTTM should keep getting.
    expect(ranksOrNone(['d'], roster)).toBeUndefined()
  })

  it('is the map as soon as one player is ranked', () => {
    expect(ranksOrNone(['c', 'd'], roster)).toEqual({ c: 1100 })
  })
})

describe('hasStoredResults', () => {
  it('is false for a level nothing has been recorded in', () => {
    expect(hasStoredResults(makeLevel(), {})).toBe(false)
  })

  it('is true even for a result that would show as stale', () => {
    // Counted as stored rather than fresh, the same way removeLevel counts them: a
    // level holding nothing but flagged results looks unplayed to view.played, and it
    // is exactly the level where moving the draw again does the most damage.
    const level = makeLevel()
    const results = playedIn(level)
    const strangers = { ...results }
    for (const stored of Object.values(strangers)) stored.playedBy = ['ghost1', 'ghost2']
    expect(hasStoredResults(level, strangers)).toBe(true)
  })

  it('ignores results belonging to another level', () => {
    expect(hasStoredResults(makeLevel(), playedIn(makeLevel({ id: 'L2' })))).toBe(false)
  })
})

describe('toppedUpRanks', () => {
  it('gives a latecomer their rank while nothing has been played', () => {
    const before = makeLevel()
    const next = { ...before, playerIds: [...before.playerIds, 'e'] }
    expect(toppedUpRanks(next, before, roster, {}).ranks).toEqual({
      a: 1600,
      b: 1550,
      c: 1100,
      e: 900,
    })
  })

  it('drops a player who has left', () => {
    const before = makeLevel()
    const next = { ...before, playerIds: ['a', 'b'] }
    expect(toppedUpRanks(next, before, roster, {}).ranks).toEqual({ a: 1600, b: 1550 })
  })

  it('never overwrites a number the level was drawn against', () => {
    // The freeze itself: the roster now says 1900, the level was drawn against 1600,
    // and January's bracket is not January's bracket if this moves.
    const before = makeLevel()
    const risen: Player[] = roster.map((p) => (p.id === 'a' ? { ...p, rank: 1900 } : p))
    expect(toppedUpRanks(before, before, risen, {}).ranks?.a).toBe(1600)
  })

  it('never retro-fits a level that was drawn without ranks', () => {
    const before = makeLevel({ ranks: undefined })
    expect(toppedUpRanks(before, before, roster, {}).ranks).toBeUndefined()
  })

  /**
   * The one that matters most. A rank can arrive at any moment — a manager looks one
   * up on Tuesday for a tournament drawn on Monday — and this runs on *every* level
   * edit, marking somebody withdrawn included. Adding a number to a level that has
   * been played would re-sort the band order under results already keyed to the seats
   * the old order produced, and hand back a tournament of flagged scores.
   */
  it('adds nothing once a result has been stored', () => {
    const before = makeLevel({ playerIds: ['a', 'b', 'c', 'd'], config: { format: 'roundRobin' } })
    const results = playedIn(before)
    // 'd' was unranked at the draw and has been given a rank since.
    const nowRanked: Player[] = roster.map((p) => (p.id === 'd' ? { ...p, rank: 1200 } : p))

    const next = toppedUpRanks({ ...before, withdrawn: ['c'] }, before, nowRanked, results)
    expect(next.ranks).toEqual(before.ranks)
    expect(next.ranks?.d).toBeUndefined()
  })

  it('leaves the draw exactly where it was across such an edit', () => {
    const before = makeLevel({ playerIds: ['a', 'b', 'c', 'd'] })
    const results = playedIn(before)
    const nowRanked: Player[] = roster.map((p) => (p.id === 'd' ? { ...p, rank: 1200 } : p))

    const next = toppedUpRanks({ ...before, withdrawn: ['c'] }, before, nowRanked, results)
    expect(levelDrawOrder(next)).toEqual(levelDrawOrder(before))
    expect(buildFixtures(next).matches.map((m) => m.id)).toEqual(
      buildFixtures(before).matches.map((m) => m.id),
    )
  })
})
