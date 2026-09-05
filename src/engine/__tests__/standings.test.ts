import { describe, expect, it } from 'vitest'
import { computeStandings, playersToExclude, type StandingsInput } from '../standings'
import type { BestOf, GameScore, Match, MatchId, MatchResult, PlayerId, StoredResult } from '../types'

/** Build an explicit match list so each scenario controls the exact topology. */
function matchesFor(pairs: Array<[PlayerId, PlayerId]>): Match[] {
  return pairs.map(([a, b], i) => ({
    id: `m${i}` as MatchId,
    levelId: 'L1',
    stage: 'group' as const,
    groupId: 'L1:g0',
    round: 0,
    order: i,
    a: { kind: 'player' as const, playerId: a },
    b: { kind: 'player' as const, playerId: b },
  }))
}

function store(matches: Match[], results: Array<MatchResult | undefined>): Record<MatchId, StoredResult> {
  const out: Record<MatchId, StoredResult> = {}
  matches.forEach((m, i) => {
    const result = results[i]
    if (!result) return
    out[m.id] = {
      result,
      playedBy: [
        m.a.kind === 'player' ? m.a.playerId : '',
        m.b.kind === 'player' ? m.b.playerId : '',
      ],
      enteredAt: 0,
    }
  })
  return out
}

const quick = (a: number, b: number): MatchResult => ({ kind: 'quick', a, b })
const detailed = (games: Array<[number, number]>): MatchResult => ({
  kind: 'detailed',
  games: games.map(([a, b]) => ({ a, b }) as GameScore),
})

function run(
  playerIds: PlayerId[],
  pairs: Array<[PlayerId, PlayerId]>,
  results: Array<MatchResult | undefined>,
  opts: { bestOf?: BestOf; seed?: string } = {},
) {
  const matches = matchesFor(pairs)
  const input: StandingsInput = {
    playerIds,
    matches,
    results: store(matches, results),
    bestOf: opts.bestOf ?? 5,
    seed: opts.seed ?? 'SEED',
  }
  return { rows: computeStandings(input), order: computeStandings(input).map((r) => r.playerId), matches, input }
}

describe('standings — basics', () => {
  it('ranks by match points and reports a complete record', () => {
    const { rows, order } = run(
      ['A', 'B', 'C'],
      [
        ['A', 'B'],
        ['A', 'C'],
        ['B', 'C'],
      ],
      [quick(3, 0), quick(3, 1), quick(3, 2)],
    )
    expect(order).toEqual(['A', 'B', 'C'])
    expect(rows[0]).toMatchObject({ playerId: 'A', played: 2, won: 2, lost: 0, matchPoints: 4, rank: 1 })
    expect(rows[2]).toMatchObject({ playerId: 'C', played: 2, won: 0, lost: 2, matchPoints: 2 })
  })

  it('gives every listed player a row even before any match is played', () => {
    const { rows } = run(['A', 'B', 'C', 'D'], [['A', 'B']], [undefined])
    expect(rows).toHaveLength(4)
    expect(rows.every((r) => r.played === 0)).toBe(true)
  })

  it('awards a forfeit loser zero match points, unlike a played loss', () => {
    const { rows } = run(
      ['A', 'B', 'C'],
      [
        ['A', 'B'],
        ['A', 'C'],
        ['B', 'C'],
      ],
      [{ kind: 'walkover', winner: 'a' }, quick(3, 0), quick(0, 3)],
    )
    const byId = Object.fromEntries(rows.map((r) => [r.playerId, r]))
    // B forfeited to A (0 pts) and lost to C in play (1 pt) -> 1, not 2.
    expect(byId['B'].matchPoints).toBe(1)
    expect(byId['B'].pointsFor).toBe(0)
  })

  it('records no points for a walkover so it cannot distort point ratio', () => {
    const { rows } = run(['A', 'B'], [['A', 'B']], [{ kind: 'walkover', winner: 'a' }])
    expect(rows[0]).toMatchObject({ playerId: 'A', gamesFor: 3, pointsFor: 0, pointsAgainst: 0 })
  })

  it('treats a double forfeit as a loss for both with no winner', () => {
    const { rows } = run(['A', 'B'], [['A', 'B']], [{ kind: 'doubleForfeit' }])
    expect(rows.every((r) => r.won === 0 && r.lost === 1 && r.matchPoints === 0)).toBe(true)
  })

  it('credits a retirement as a full win while keeping the games played', () => {
    const { rows } = run(
      ['A', 'B'],
      [['A', 'B']],
      [{ kind: 'retired', winner: 'a', games: [{ a: 11, b: 9 }, { a: 5, b: 3 }] }],
    )
    const a = rows.find((r) => r.playerId === 'A')!
    expect(a.won).toBe(1)
    expect(a.gamesFor).toBe(3)
    expect(a.pointsFor).toBe(16)
  })
})

describe('standings — tiebreaks', () => {
  it('separates a two-way tie by head-to-head even when point ratio disagrees', () => {
    // A wins the match 3-2 but is outscored on total points across the five games.
    // Head-to-head must be applied first, so A finishes above B.
    const headToHeadLoserOutscores = detailed([
      [11, 9],
      [11, 9],
      [11, 9],
      [0, 11],
      [0, 11],
    ])
    const { rows, order } = run(
      ['A', 'B'],
      [['A', 'B']],
      [headToHeadLoserOutscores],
    )
    expect(rows.find((r) => r.playerId === 'A')!.pointsFor).toBeLessThan(
      rows.find((r) => r.playerId === 'B')!.pointsFor,
    )
    expect(order).toEqual(['A', 'B'])
  })

  it('resolves a three-way cycle into a stable total order', () => {
    const pairs: Array<[PlayerId, PlayerId]> = [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
    ]
    const results = [quick(3, 0), quick(3, 1), quick(3, 2)]
    const first = run(['A', 'B', 'C'], pairs, results)
    const second = run(['A', 'B', 'C'], pairs, results)

    // All three are level on match points, so the cycle must be broken further down.
    expect(first.rows.every((r) => r.matchPoints === 3)).toBe(true)
    expect(new Set(first.order).size).toBe(3)
    expect(first.order).toEqual(second.order)
    // Game ratio: A 5:3, C 4:4, B 3:5.
    expect(first.order).toEqual(['A', 'C', 'B'])
    expect(first.rows[0].tiebreakReason).toBe('gameRatio')
  })

  it('ranks an unbeaten record first without dividing by zero', () => {
    // A wins every match without dropping a game, so its game ratio has a zero
    // denominator. Ratios are compared by cross-multiplication, so this is an
    // ordinary comparison rather than an Infinity.
    const { rows, order } = run(
      ['A', 'B', 'C', 'D'],
      [
        ['A', 'B'],
        ['A', 'C'],
        ['A', 'D'],
        ['B', 'C'],
        ['B', 'D'],
        ['C', 'D'],
      ],
      [quick(3, 0), quick(3, 0), quick(3, 0), quick(3, 1), quick(3, 1), quick(3, 1)],
    )
    expect(order).toEqual(['A', 'B', 'C', 'D'])
    expect(rows[0]).toMatchObject({ playerId: 'A', gamesAgainst: 0, matchPoints: 6 })
    expect(rows.every((r) => Number.isFinite(r.matchPoints))).toBe(true)
  })

  it('scores a played loss above a forfeit, so match counts must be equal to compare', () => {
    // Documents a real ITTF property that surprises people mid-group: a player who
    // has played more matches can lead on match points, because a played loss is
    // worth 1. Standings are only meaningful once every player has the same number
    // of matches behind them.
    const { rows } = run(
      ['A', 'B', 'C'],
      [
        ['A', 'B'],
        ['B', 'C'],
      ],
      [quick(3, 0), quick(3, 0)],
    )
    const byId = Object.fromEntries(rows.map((r) => [r.playerId, r]))
    expect(byId['A'].matchPoints).toBe(2) // one win, one match played
    expect(byId['B'].matchPoints).toBe(3) // one win and one played loss
  })

  it('skips point ratio when the tied matches carry no game scores', () => {
    const pairs: Array<[PlayerId, PlayerId]> = [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
    ]
    // Symmetric cycle: match points and game ratio are all identical, so the only
    // thing left is point ratio — which quick entry never recorded, so this must go
    // to lot, and the lot must say it was the missing scores that got it there.
    const { rows } = run(['A', 'B', 'C'], pairs, [quick(3, 1), quick(3, 1), quick(3, 1)])
    expect(rows.every((r) => r.tiebreakReason === 'lotPointsUnavailable')).toBe(true)
    // It must also name the dead heat: that list is what the tiebreak resolver
    // collects the matches from.
    expect(rows.every((r) => r.tieGroup?.join(',') === 'A,B,C')).toBe(true)
  })

  it('reports a plain lot when detailed scores are in and still inseparable', () => {
    const pairs: Array<[PlayerId, PlayerId]> = [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
    ]
    // Identical 3-1 scorelines all round: point ratio ran and could not split them,
    // so there is nothing left for the user to enter.
    const games: Array<[number, number]> = [
      [11, 9],
      [11, 9],
      [9, 11],
      [11, 9],
    ]
    const { rows } = run(['A', 'B', 'C'], pairs, [detailed(games), detailed(games), detailed(games)])
    expect(rows.every((r) => r.tiebreakReason === 'lot')).toBe(true)
  })

  it('does not blame missing scores when the tied matches were walkovers', () => {
    const pairs: Array<[PlayerId, PlayerId]> = [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
    ]
    // A walkover has no points to enter, so entering game scores would change
    // nothing — this is a plain lot, not an actionable one.
    const wo = (winner: 'a' | 'b'): MatchResult => ({ kind: 'walkover', winner })
    const { rows } = run(['A', 'B', 'C'], pairs, [wo('a'), wo('a'), wo('a')])
    expect(rows.every((r) => r.tiebreakReason === 'lot')).toBe(true)
  })

  it('separates a tie on points that were entered for the tied matches alone', () => {
    // What the tiebreak resolver produces: a night run on quick entry where only the
    // three matches inside the dead heat were given their game scores. Point ratio
    // must run on them — it is the recorded data that decides, never the tournament's
    // entry mode, or those scores would be stored and then ignored.
    const pairs: Array<[PlayerId, PlayerId]> = [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
      ['A', 'D'],
      ['B', 'D'],
      ['C', 'D'],
    ]
    const { rows } = run(['A', 'B', 'C', 'D'], pairs, [
      detailed([[11, 0], [11, 0], [0, 11], [11, 0]]),
      detailed([[11, 8], [11, 8], [8, 11], [11, 8]]),
      detailed([[11, 9], [11, 9], [9, 11], [11, 9]]),
      quick(3, 0),
      quick(3, 0),
      quick(3, 0),
    ])
    expect(rows.map((r) => r.playerId)).toEqual(['A', 'C', 'B', 'D'])
    expect(rows[0].tiebreakReason).toBe('pointRatio')
  })

  it('does not blame missing scores when one tied match has no points to enter', () => {
    // Four level on match points and on games: a cycle of quick wins, plus a pair of
    // forfeited matches that score nothing for anybody. Entering the quick matches'
    // games would still leave those two without points, so point ratio can never run
    // here — and saying otherwise sends the user off to type in scores that change
    // nothing.
    const pairs: Array<[PlayerId, PlayerId]> = [
      ['A', 'B'],
      ['C', 'D'],
      ['A', 'C'],
      ['C', 'B'],
      ['B', 'D'],
      ['D', 'A'],
    ]
    const dead: MatchResult = { kind: 'doubleForfeit' }
    const { rows } = run(['A', 'B', 'C', 'D'], pairs, [
      dead,
      dead,
      quick(3, 1),
      quick(3, 1),
      quick(3, 1),
      quick(3, 1),
    ])
    expect(rows.every((r) => r.matchPoints === 3)).toBe(true)
    expect(rows.every((r) => r.tiebreakReason === 'lot')).toBe(true)
  })

  it('uses point ratio before lot when detailed scores are available', () => {
    const pairs: Array<[PlayerId, PlayerId]> = [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
    ]
    // Same 3-1 cycle, but now with points that differ between the three.
    const { rows } = run(['A', 'B', 'C'], pairs, [
      detailed([[11, 0], [11, 0], [0, 11], [11, 0]]),
      detailed([[11, 8], [11, 8], [8, 11], [11, 8]]),
      detailed([[11, 9], [11, 9], [9, 11], [11, 9]]),
    ])
    expect(rows.every((r) => r.matchPoints === 3)).toBe(true)
    expect(rows.map((r) => r.tiebreakReason)).not.toContain('lot')
    expect(rows[0].tiebreakReason).toBe('pointRatio')
  })

  it('draws lots deterministically when players are genuinely inseparable', () => {
    const pairs: Array<[PlayerId, PlayerId]> = [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
    ]
    const results = [quick(3, 1), quick(3, 1), quick(3, 1)]
    const a = run(['A', 'B', 'C'], pairs, results, { seed: 'S1' })
    const b = run(['A', 'B', 'C'], pairs, results, { seed: 'S1' })
    const c = run(['A', 'B', 'C'], pairs, results, { seed: 'S2' })

    expect(a.order).toEqual(b.order)
    expect(a.rows.every((r) => r.tiebreakReason === 'lotPointsUnavailable')).toBe(true)
    // A different seed is free to produce a different lot; the set is unchanged.
    expect(c.order.slice().sort()).toEqual(['A', 'B', 'C'])
  })

  it('does not let the lot depend on the order players were listed in', () => {
    const pairs: Array<[PlayerId, PlayerId]> = [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
    ]
    const results = [quick(3, 1), quick(3, 1), quick(3, 1)]
    const forward = run(['A', 'B', 'C'], pairs, results)
    const reversed = run(['C', 'B', 'A'], pairs, results)
    expect(forward.order).toEqual(reversed.order)
  })

  it('ranks a split tier above and below correctly, resolving each side independently', () => {
    // A and B win two each, C and D win none; the top pair and bottom pair are then
    // separated by their own head-to-head meetings.
    const { order } = run(
      ['A', 'B', 'C', 'D'],
      [
        ['A', 'C'],
        ['A', 'D'],
        ['B', 'C'],
        ['B', 'D'],
        ['A', 'B'],
        ['C', 'D'],
      ],
      [quick(3, 0), quick(3, 0), quick(3, 0), quick(3, 0), quick(3, 0), quick(3, 0)],
    )
    expect(order[0]).toBe('A')
    expect(order[3]).toBe('D')
  })
})

describe('withdrawals', () => {
  const pairs: Array<[PlayerId, PlayerId]> = [
    ['A', 'B'],
    ['A', 'C'],
    ['A', 'D'],
    ['B', 'C'],
    ['B', 'D'],
    ['C', 'D'],
  ]

  it('strikes a player who completed fewer than half their matches', () => {
    const matches = matchesFor(pairs)
    const results = store(matches, [
      quick(3, 0),
      { kind: 'walkover', winner: 'a' },
      { kind: 'walkover', winner: 'a' },
      quick(3, 0),
      quick(3, 0),
      quick(3, 0),
    ])
    // A played 1 of 3 and walked over the rest: struck from the table.
    expect(playersToExclude(matches, results, ['A'])).toEqual(new Set(['A']))
  })

  it('keeps a player who completed at least half their matches', () => {
    const matches = matchesFor(pairs)
    const results = store(matches, [
      quick(3, 0),
      quick(3, 0),
      { kind: 'walkover', winner: 'a' },
      quick(3, 0),
      quick(3, 0),
      quick(3, 0),
    ])
    expect(playersToExclude(matches, results, ['A'])).toEqual(new Set())
  })

  it('removes an excluded player and their results from every opponent record', () => {
    const matches = matchesFor(pairs)
    const results = store(matches, [
      quick(3, 0),
      quick(3, 0),
      quick(3, 0),
      quick(3, 0),
      quick(3, 0),
      quick(3, 0),
    ])
    const rows = computeStandings({
      playerIds: ['B', 'C', 'D'],
      matches,
      results,
      bestOf: 5,
      seed: 'S',
      excluded: new Set(['A']),
    })
    // Nobody is credited a win over the struck player.
    expect(rows.every((r) => r.played === 2)).toBe(true)
    expect(rows.map((r) => r.playerId)).toHaveLength(3)
  })
})
