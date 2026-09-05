import { describe, expect, it } from 'vitest'
import { planAdoption } from './adopt'
import { buildFixtures, levelDrawOrder, resolveLevel } from '../engine/resolve'
import type { Player, Tournament } from '../engine/types'

/** A night run on the spare tablet: its own player ids, its own results. */
function shared(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't-away',
    name: 'ערב שלישי',
    date: '2026-03-03',
    scoreMode: 'quick',
    tableCount: 2,
    levels: [
      {
        id: 'L1',
        name: 'א׳',
        playerIds: ['a1', 'a2', 'a3', 'a4'],
        config: { format: 'roundRobin' },
        bestOf: 5,
        seed: 'SEED1234',
        withdrawn: ['a4'],
      },
    ],
    players: [
      { id: 'a1', name: 'דנה' },
      { id: 'a2', name: 'Ben' },
      { id: 'a3', name: 'יואב' },
      { id: 'a4', name: 'Chen' },
    ],
    results: {},
    tableAssignments: {},
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  }
}

/** The manager's own device already knows three of those four people. */
const roster: Player[] = [
  { id: 'home-dana', name: 'דנה', photo: 'data:image/jpeg;base64,AAAA' },
  { id: 'home-ben', name: 'ben' },
  { id: 'home-yoav', name: 'יואב' },
]

describe('adopting a shared tournament', () => {
  it('rewrites recognised players onto the ids this device already uses', () => {
    const plan = planAdoption(shared(), roster, [])

    expect(plan.matched).toBe(3)
    expect(plan.tournament.levels[0].playerIds).toEqual(['home-dana', 'home-ben', 'home-yoav', 'a4'])
    // The local spelling wins, so the tournament reads like the rest of the history.
    expect(plan.tournament.players.map((p) => p.name)).toEqual(['דנה', 'ben', 'יואב', 'Chen'])
  })

  it('adds the strangers to the roster under the id they arrived with', () => {
    const plan = planAdoption(shared(), roster, [])
    expect(plan.newPlayers).toEqual([{ id: 'a4', name: 'Chen' }])
  })

  it('rewrites every list a player id appears in', () => {
    const away = shared({
      levels: [{ ...shared().levels[0], manualOrder: ['a3', 'a1'], withdrawn: ['a2'] }],
      results: {
        'L1:g0:r0:m0': {
          result: { kind: 'quick', a: 3, b: 1 },
          playedBy: ['a1', 'a4'],
          enteredAt: 1,
        },
      },
    })
    const plan = planAdoption(away, roster, [])
    const level = plan.tournament.levels[0]

    expect(level.manualOrder).toEqual(['home-yoav', 'home-dana'])
    expect(level.withdrawn).toEqual(['home-ben'])
    expect(plan.tournament.results['L1:g0:r0:m0'].playedBy).toEqual(['home-dana', 'a4'])
  })

  /**
   * The load-bearing property: results are keyed by match id, so a rewrite that moved
   * a single match id would detach every score in the tournament from its match.
   */
  it('leaves the fixtures, and therefore the results, exactly where they were', () => {
    const away = shared()
    const results: Tournament['results'] = {}
    for (const match of buildFixtures(away.levels[0]).matches) {
      if (match.a.kind !== 'player' || match.b.kind !== 'player') continue
      results[match.id] = {
        result: { kind: 'quick', a: 3, b: 0 },
        playedBy: [match.a.playerId, match.b.playerId],
        enteredAt: 1,
      }
    }
    const withResults = { ...away, results }
    const plan = planAdoption(withResults, roster, [])
    const level = plan.tournament.levels[0]

    expect(buildFixtures(level).matches.map((m) => m.id)).toEqual(
      buildFixtures(away.levels[0]).matches.map((m) => m.id),
    )
    // Same draw, same order, only the names on it: position for position, each id is
    // the rewrite of the one that was there.
    const rewrite = new Map(away.players.map((p, i) => [p.id, plan.tournament.players[i].id]))
    expect(levelDrawOrder(level)).toEqual(levelDrawOrder(away.levels[0]).map((id) => rewrite.get(id)))
    // And nothing went stale: every result still belongs to the two people standing
    // at its table, which is what keeps it in the standings.
    const view = resolveLevel(level, plan.tournament.results)
    expect(view.stale).toHaveLength(0)
    expect(view.played).toBe(Object.keys(results).length)
  })

  it('keeps two people who share a name apart', () => {
    const away = shared({
      players: [
        { id: 'a1', name: 'Ben' },
        { id: 'a2', name: 'Ben' },
        { id: 'a3', name: 'יואב' },
        { id: 'a4', name: 'Chen' },
      ],
    })
    const plan = planAdoption(away, roster, [])

    // The first takes the local Ben; the second stays himself rather than merging
    // into a record that is not his.
    expect(plan.tournament.levels[0].playerIds).toEqual(['home-ben', 'a2', 'home-yoav', 'a4'])
    expect(plan.newPlayers.map((p) => p.id)).toEqual(['a2', 'a4'])
  })

  it('matches names past the case and stray spaces of a phone keyboard', () => {
    const away = shared({
      players: [
        { id: 'a1', name: ' דנה ' },
        { id: 'a2', name: 'BEN' },
        { id: 'a3', name: 'יואב' },
        { id: 'a4', name: 'Chen  Levi' },
      ],
    })
    const plan = planAdoption(away, roster, [])

    expect(plan.matched).toBe(3)
    // Matching is tolerant; storing is faithful — the stranger keeps their spelling.
    expect(plan.newPlayers).toEqual([{ id: 'a4', name: 'Chen  Levi' }])
  })

  it('prefers an id it already knows over a name that merely matches', () => {
    const plan = planAdoption(shared(), [{ id: 'a1', name: 'Dana G' }, ...roster], [])
    expect(plan.tournament.levels[0].playerIds[0]).toBe('a1')
    expect(plan.tournament.players[0].name).toBe('Dana G')
  })

  it('says when it is about to replace a tournament already stored here', () => {
    expect(planAdoption(shared(), roster, [shared()]).replaces).toBe(true)
    expect(planAdoption(shared(), roster, [shared({ id: 'other' })]).replaces).toBe(false)
  })

  it('adopts onto an empty device without touching anything', () => {
    const away = shared()
    const plan = planAdoption(away, [], [])

    expect(plan.matched).toBe(0)
    expect(plan.newPlayers).toHaveLength(4)
    expect(plan.tournament).toEqual(away)
  })
})
