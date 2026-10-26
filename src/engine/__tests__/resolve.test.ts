import { describe, expect, it } from 'vitest'
import { buildFixtures, resolveLevel, type LevelView } from '../resolve'
import type { FormatConfig, Level, Match, MatchId, PlayerId, StoredResult } from '../types'

const players = (n: number): PlayerId[] => Array.from({ length: n }, (_, i) => `p${i + 1}`)

function makeLevel(config: FormatConfig, playerCount: number, seed = 'SEED1234'): Level {
  return {
    id: 'L1',
    name: 'A',
    playerIds: players(playerCount),
    config,
    bestOf: 5,
    seed,
    withdrawn: [],
  }
}

type Results = Record<MatchId, StoredResult>

/** Record a win for whoever currently occupies `side` of the given match. */
function enter(view: LevelView, results: Results, matchId: MatchId, side: 'a' | 'b' = 'a'): void {
  const v = view.byId.get(matchId)
  if (!v || v.a.kind !== 'player' || v.b.kind !== 'player') {
    throw new Error(`match ${matchId} is not playable`)
  }
  results[matchId] = {
    result: { kind: 'quick', a: side === 'a' ? 3 : 0, b: side === 'b' ? 3 : 0 },
    playedBy: [v.a.playerId, v.b.playerId],
    enteredAt: 0,
  }
}

/** Play every playable match, always awarding side A, until nothing is left. */
function playOut(level: Level): { results: Results; view: LevelView } {
  const results: Results = {}
  let view = resolveLevel(level, results)
  for (let guard = 0; guard < 200; guard++) {
    const next = view.matches.find((m) => m.playable && !m.result)
    if (!next) break
    enter(view, results, next.match.id)
    view = resolveLevel(level, results)
  }
  return { results, view }
}

describe('fixture generation', () => {
  it('is reproducible from the seed', () => {
    const level = makeLevel({ format: 'roundRobin' }, 8)
    const a = buildFixtures(level)
    const b = buildFixtures(level)
    expect(a.matches.map((m) => [m.id, m.a, m.b])).toEqual(b.matches.map((m) => [m.id, m.a, m.b]))
  })

  it('produces a different draw for a different seed', () => {
    const a = buildFixtures(makeLevel({ format: 'singleElim' }, 16, 'AAAA1111'))
    const b = buildFixtures(makeLevel({ format: 'singleElim' }, 16, 'BBBB2222'))
    expect(a.matches.map((m) => JSON.stringify(m.a))).not.toEqual(b.matches.map((m) => JSON.stringify(m.a)))
  })

  it('places every player exactly once', () => {
    const { matches } = buildFixtures(makeLevel({ format: 'singleElim' }, 12))
    const placed = matches
      .flatMap((m) => [m.a, m.b])
      .filter((s) => s.kind === 'player')
      .map((s) => (s.kind === 'player' ? s.playerId : ''))
    expect(placed.slice().sort()).toEqual(players(12).slice().sort())
  })
})

describe('byes', () => {
  it('auto-advances a player facing a bye without needing a result', () => {
    const level = makeLevel({ format: 'singleElim' }, 12)
    const view = resolveLevel(level, {})
    const autos = view.matches.filter((m) => m.auto)

    expect(autos).toHaveLength(4) // 16-slot bracket, 12 players
    for (const m of autos) {
      expect(m.winner).toBeDefined()
      expect(m.playable).toBe(false)
      expect(m.result).toBeUndefined()
    }
  })

  it('carries the auto-advanced player into the next round', () => {
    const level = makeLevel({ format: 'singleElim' }, 12)
    const view = resolveLevel(level, {})
    const auto = view.matches.find((m) => m.auto)!
    const next = view.matches.find(
      (m) =>
        m.match.round === auto.match.round + 1 &&
        m.match.order === Math.floor(auto.match.order / 2),
    )!
    const sides = [next.a, next.b].map((p) => (p.kind === 'player' ? p.playerId : p.kind))
    expect(sides).toContain(auto.winner)
  })

  it('counts only real matches as playable', () => {
    const view = resolveLevel(makeLevel({ format: 'singleElim' }, 12), {})
    // 12 players in a 16 bracket: 15 nodes, 4 decided by bye.
    expect(view.matches).toHaveLength(15)
    expect(view.total).toBe(11)
  })
})

describe('playing out a bracket', () => {
  it('produces exactly one champion', () => {
    const { view } = playOut(makeLevel({ format: 'singleElim' }, 8))
    expect(view.complete).toBe(true)
    expect(view.champion).toBeDefined()
    expect(view.played).toBe(view.total)
  })

  it('handles a field that is not a power of two', () => {
    for (const count of [5, 7, 11, 13]) {
      const { view } = playOut(makeLevel({ format: 'singleElim' }, count))
      expect(view.champion, `field of ${count}`).toBeDefined()
      expect(view.complete).toBe(true)
    }
  })

  it('crowns the table-topper in a pure round robin', () => {
    const { view } = playOut(makeLevel({ format: 'roundRobin' }, 6))
    expect(view.complete).toBe(true)
    const table = view.standings.get(view.groups[0].id)!
    expect(view.champion).toBe(table[0].playerId)
    expect(table).toHaveLength(6)
  })
})

describe('editing a result', () => {
  it('recomputes the whole downstream tree', () => {
    const level = makeLevel({ format: 'singleElim' }, 4)
    const results: Results = {}
    let view = resolveLevel(level, results)

    const [sf1, sf2] = view.matches.filter((m) => m.match.round === 0)
    enter(view, results, sf1.match.id, 'a')
    enter(view, results, sf2.match.id, 'a')
    view = resolveLevel(level, results)

    const final = view.matches.find((m) => m.match.round === 1)!
    const firstFinalist = final.a.kind === 'player' ? final.a.playerId : undefined
    expect(firstFinalist).toBe(sf1.a.kind === 'player' ? sf1.a.playerId : undefined)

    // Flip the first semi-final; the final's participant must change with it.
    enter(view, results, sf1.match.id, 'b')
    view = resolveLevel(level, results)
    const updated = view.matches.find((m) => m.match.round === 1)!
    expect(updated.a.kind === 'player' ? updated.a.playerId : undefined).not.toBe(firstFinalist)
  })

  it('flags a downstream result as stale rather than misattributing it', () => {
    const level = makeLevel({ format: 'singleElim' }, 4)
    const results: Results = {}
    let view = resolveLevel(level, results)

    const [sf1, sf2] = view.matches.filter((m) => m.match.round === 0)
    enter(view, results, sf1.match.id, 'a')
    enter(view, results, sf2.match.id, 'a')
    view = resolveLevel(level, results)

    const final = view.matches.find((m) => m.match.round === 1)!
    enter(view, results, final.match.id, 'a')
    view = resolveLevel(level, results)
    const originalChampion = view.champion
    expect(originalChampion).toBeDefined()

    // Correct the first semi-final. The final was played by someone who is no longer
    // in it, so its stored result must not silently crown a different player.
    enter(view, results, sf1.match.id, 'b')
    view = resolveLevel(level, results)

    const staleFinal = view.byId.get(final.match.id)!
    expect(staleFinal.staleness).toBe('mismatched')
    expect(staleFinal.result).toBeUndefined()
    expect(view.stale.map((m) => m.match.id)).toContain(final.match.id)
    expect(view.champion).toBeUndefined()
    expect(view.complete).toBe(false)
  })

  it('distinguishes a swap from a genuine mismatch', () => {
    const level = makeLevel({ format: 'roundRobin' }, 4)
    const { matches } = buildFixtures(level)
    const first = matches[0]
    const a = first.a.kind === 'player' ? first.a.playerId : ''
    const b = first.b.kind === 'player' ? first.b.playerId : ''

    const swapped: Results = {
      [first.id]: {
        result: { kind: 'quick', a: 3, b: 0 },
        playedBy: [b, a],
        enteredAt: 0,
      },
    }
    const view = resolveLevel(level, swapped)
    expect(view.byId.get(first.id)!.staleness).toBe('swapped')
  })
})

describe('groups into knockout', () => {
  const config: FormatConfig = { format: 'groupsKnockout', groupCount: 4, advancePerGroup: 2 }

  it('keeps bracket slots undetermined until the groups finish', () => {
    const level = makeLevel(config, 16)
    const view = resolveLevel(level, {})
    const bracket = view.matches.filter((m) => m.match.stage !== 'group')
    expect(bracket.length).toBeGreaterThan(0)
    expect(bracket.every((m) => !m.playable)).toBe(true)
    expect(view.matches.filter((m) => m.match.stage === 'group').every((m) => m.playable)).toBe(true)
  })

  it('feeds group qualifiers into the bracket once the groups are complete', () => {
    const level = makeLevel(config, 16)
    const results: Results = {}
    let view = resolveLevel(level, results)

    for (const m of view.matches.filter((m) => m.match.stage === 'group')) {
      enter(view, results, m.match.id)
    }
    view = resolveLevel(level, results)

    const firstRound = view.matches.filter((m) => m.match.stage !== 'group' && m.match.round === 0)
    expect(firstRound.every((m) => m.playable)).toBe(true)

    // Exactly the top two of each group advance.
    const qualified = new Set(
      firstRound.flatMap((m) =>
        [m.a, m.b].map((p) => (p.kind === 'player' ? p.playerId : '')).filter(Boolean),
      ),
    )
    expect(qualified.size).toBe(8)
    for (const group of view.groups) {
      const top2 = view.standings.get(group.id)!.slice(0, 2).map((r) => r.playerId)
      for (const id of top2) expect(qualified.has(id)).toBe(true)
    }
  })

  it('never pairs two players from the same group in the first knockout round', () => {
    for (const [groupCount, playerCount] of [[3, 12], [4, 16], [5, 20], [6, 24], [7, 28]] as const) {
      const level = makeLevel(
        { format: 'groupsKnockout', groupCount, advancePerGroup: 2 },
        playerCount,
      )
      const { matches } = buildFixtures(level)
      const firstRound = matches.filter((m) => m.stage !== 'group' && m.round === 0)
      for (const m of firstRound) {
        if (m.a.kind === 'groupRank' && m.b.kind === 'groupRank') {
          expect(m.a.groupId, `${groupCount} groups`).not.toBe(m.b.groupId)
        }
      }
    }
  })

  it('plays through to a champion', () => {
    const { view } = playOut(makeLevel(config, 16))
    expect(view.champion).toBeDefined()
    expect(view.complete).toBe(true)
  })
})

/**
 * The round in which two bracket seats can first meet: 0 is the first round, and the
 * last round is the final. Seats share a match in round R once they fall in the same
 * block of 2^(R+1).
 */
function meetingRound(p: number, q: number): number {
  let round = 0
  while (Math.floor(p / 2 ** (round + 1)) !== Math.floor(q / 2 ** (round + 1))) round++
  return round
}

/** Each group's qualifiers by rank, with the bracket seat the draw gave them. */
function seatsByGroup(matches: readonly Match[]): { size: number; groups: Map<string, number[]> } {
  const firstRound = matches.filter((m) => m.stage !== 'group' && m.round === 0 && !m.consolation)
  const groups = new Map<string, number[]>()
  for (const m of firstRound) {
    for (const [slot, seat] of [[m.a, m.order * 2], [m.b, m.order * 2 + 1]] as const) {
      if (slot.kind !== 'groupRank') continue
      const seats = groups.get(slot.groupId) ?? []
      seats[slot.rank - 1] = seat
      groups.set(slot.groupId, seats)
    }
  }
  return { size: firstRound.length * 2, groups }
}

describe('groupmates in the knockout', () => {
  const apart = (groupCount: number, advancePerGroup: number): FormatConfig => ({
    format: 'groupsKnockout',
    groupCount,
    advancePerGroup,
    separateGroups: true,
  })

  // The report this exists for: four groups, two through from each, and A1 and A2 one
  // semi-final away from playing each other a second time.
  it('lets two from one group meet only in the final', () => {
    for (let groupCount = 2; groupCount <= 11; groupCount++) {
      const level = makeLevel(apart(groupCount, 2), groupCount * 4)
      const { size, groups } = seatsByGroup(buildFixtures(level).matches)
      const final = Math.log2(size) - 1
      expect(groups.size).toBe(groupCount)
      for (const [groupId, [winner, runnerUp]] of groups) {
        expect(meetingRound(winner, runnerUp), `${groupCount} groups, ${groupId}`).toBe(final)
      }
    }
  })

  it('lets four from one group meet no earlier than the semi-finals, the top two in the final', () => {
    for (let groupCount = 2; groupCount <= 11; groupCount++) {
      const level = makeLevel(apart(groupCount, 4), groupCount * 5)
      const { size, groups } = seatsByGroup(buildFixtures(level).matches)
      const final = Math.log2(size) - 1
      for (const [groupId, seats] of groups) {
        const label = `${groupCount} groups, ${groupId}`
        expect(seats.filter((seat) => seat !== undefined), label).toHaveLength(4)
        expect(meetingRound(seats[0], seats[1]), label).toBe(final)
        for (let i = 0; i < 4; i++) {
          for (let j = i + 1; j < 4; j++) {
            expect(meetingRound(seats[i], seats[j]), label).toBeGreaterThanOrEqual(final - 1)
          }
        }
      }
    }
  })

  it('never pairs groupmates before the final, whoever wins', () => {
    const level = makeLevel(apart(4, 2), 16)
    const groupStage: Results = {}
    let view = resolveLevel(level, groupStage)
    for (const m of view.matches.filter((m) => m.match.stage === 'group')) {
      enter(view, groupStage, m.match.id)
    }
    view = resolveLevel(level, groupStage)

    const groupOf = new Map<PlayerId, string>()
    for (const group of view.groups) for (const id of group.playerIds) groupOf.set(id, group.id)
    const knockout = view.matches.filter((m) => m.match.stage !== 'group')
    const lastRound = Math.max(...knockout.map((m) => m.match.round))

    // Every one of the 2^7 ways the knockout can go, not only the one where side A
    // always wins — that path happens to keep A1 and A2 apart under the old seeding.
    let finals = 0
    const explore = (results: Results): void => {
      const view = resolveLevel(level, results)
      const next = view.matches.find((m) => m.match.stage !== 'group' && m.playable && !m.result)
      if (!next) {
        finals++
        return
      }
      if (next.a.kind === 'player' && next.b.kind === 'player' && next.match.round < lastRound) {
        expect(groupOf.get(next.a.playerId), next.match.id).not.toBe(groupOf.get(next.b.playerId))
      }
      for (const side of ['a', 'b'] as const) {
        const branch = { ...results }
        enter(view, branch, next.match.id, side)
        explore(branch)
      }
    }
    explore(groupStage)
    expect(finals).toBe(2 ** 7)
  })

  it('moves nobody where standard seeding already kept the groups apart', () => {
    const shape = (config: FormatConfig) =>
      buildFixtures(makeLevel(config, 8)).matches.map((m) => [m.id, m.a, m.b])
    expect(shape(apart(2, 2))).toEqual(
      shape({ format: 'groupsKnockout', groupCount: 2, advancePerGroup: 2 }),
    )
  })

  // Re-seating qualifiers under a knockout already played would detach every result in
  // it, so a level drawn before the rule must go on deriving the bracket it was played
  // on — the one that let A1 and A2 meet in a semi-final.
  it('leaves a level drawn before the rule the bracket it was played on', () => {
    const { matches } = buildFixtures(
      makeLevel({ format: 'groupsKnockout', groupCount: 4, advancePerGroup: 2 }, 16),
    )
    const firstRound = matches
      .filter((m) => m.stage !== 'group' && m.round === 0)
      .map((m) => [m.a, m.b].map((s) => (s.kind === 'groupRank' ? `${s.groupId}#${s.rank}` : s.kind)))
    expect(firstRound).toEqual([
      ['L1:g0#1', 'L1:g3#2'],
      ['L1:g3#1', 'L1:g0#2'],
      ['L1:g1#1', 'L1:g2#2'],
      ['L1:g2#1', 'L1:g1#2'],
    ])
  })
})
