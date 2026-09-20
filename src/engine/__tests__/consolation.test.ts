import { describe, expect, it } from 'vitest'
import { buildFixtures, resolveLevel, type LevelView } from '../resolve'
import { consolationLevel } from '../formats/consolation'
import { consolationConfig, consolationFieldSize, describe as shapeOf } from '../advisor'
import { playerStats } from '../stats'
import type {
  FormatConfig,
  Level,
  MatchId,
  PlayerId,
  StoredResult,
  Tournament,
} from '../types'

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

/** Play every playable match; `pick` decides who wins each one. */
function playOut(
  level: Level,
  pick: (view: LevelView, i: number) => 'a' | 'b' = () => 'a',
  stop: (view: LevelView) => boolean = () => false,
): { results: Results; view: LevelView } {
  const results: Results = {}
  let view = resolveLevel(level, results)
  for (let i = 0; i < 400; i++) {
    if (stop(view)) break
    const next = view.matches.find((m) => m.playable && !m.result)
    if (!next) break
    enter(view, results, next.match.id, pick(view, i))
    view = resolveLevel(level, results)
  }
  return { results, view }
}

const consolationOf = (view: LevelView) => view.matches.filter((m) => m.match.consolation)
const mainOf = (view: LevelView) => view.matches.filter((m) => !m.match.consolation)

/** Everyone who actually stood at a table in these matches. */
function entrants(views: ReturnType<typeof consolationOf>): Set<PlayerId> {
  const out = new Set<PlayerId>()
  for (const v of views) {
    if (v.a.kind === 'player') out.add(v.a.playerId)
    if (v.b.kind === 'player') out.add(v.b.playerId)
  }
  return out
}

describe('consolation — single elimination', () => {
  it('picks up every loser but the beaten finalist', () => {
    const level = makeLevel({ format: 'singleElim', consolation: true }, 8)
    const { view } = playOut(level)

    expect(consolationOf(view)).toHaveLength(5)

    const final = mainOf(view).find((m) => m.match.round === 2)!
    const field = entrants(consolationOf(view))
    expect(field.size).toBe(6)
    expect(field.has(final.loser!)).toBe(false)
    expect(field.has(view.champion!)).toBe(false)
  })

  it('exists from the moment of the draw, before anything is played', () => {
    const level = makeLevel({ format: 'singleElim', consolation: true }, 8)
    const { matches } = buildFixtures(level)
    expect(matches.filter((m) => m.consolation)).toHaveLength(5)
    expect(resolveLevel(level, {}).consolationPending).toBe(false)
  })

  it('never admits a rematch in the first drop, at any size', () => {
    for (const n of [4, 8, 16]) {
      const level = makeLevel({ format: 'singleElim', consolation: true }, n)
      const mainCount = buildFixtures(level).matches.filter((m) => !m.consolation).length

      for (let bits = 0; bits < 1 << mainCount; bits++) {
        const { view } = playOut(level, (_v, i) => ((bits >> (i % mainCount)) & 1 ? 'a' : 'b'))
        const seen = new Set<string>()
        for (const m of view.matches) {
          if (!m.playable || m.auto || m.vacant) continue
          const a = m.a.kind === 'player' ? m.a.playerId : ''
          const b = m.b.kind === 'player' ? m.b.playerId : ''
          const key = a < b ? `${a}|${b}` : `${b}|${a}`
          // Consolation rounds 0 and 1 are the opening round and the first drop —
          // the only ones a permutation can keep clean, and it does.
          if (m.match.consolation && m.match.round <= 1) expect(seen.has(key)).toBe(false)
          seen.add(key)
        }
      }
    }
  }, 120_000)

  it('gives a bye no loser to send down, and walks the opponent over', () => {
    // 12 in a 16-draw: four opening matches are byes and yield nobody.
    const level = makeLevel({ format: 'singleElim', consolation: true }, 12)
    const { view } = playOut(level)

    expect(entrants(consolationOf(view)).size).toBe(10)
    const opening = consolationOf(view).filter((m) => m.match.round === 0)
    expect(opening.some((m) => m.auto)).toBe(true)
    expect(opening.every((m) => m.a.kind !== 'bye' && m.b.kind !== 'bye')).toBe(true)
  })

  it('leaves every main-draw match id untouched when it is switched on', () => {
    const off = buildFixtures(makeLevel({ format: 'singleElim' }, 12))
    const on = buildFixtures(makeLevel({ format: 'singleElim', consolation: true }, 12))
    expect(on.matches.filter((m) => !m.consolation).map((m) => m.id)).toEqual(
      off.matches.map((m) => m.id),
    )
  })
})

describe('consolation — groups then knockout', () => {
  const config: FormatConfig = {
    format: 'groupsKnockout',
    groupCount: 4,
    advancePerGroup: 2,
    consolation: true,
  }

  it('waits for the whole group stage, then takes exactly the non-qualifiers', () => {
    const level = makeLevel(config, 16)

    const early = playOut(level, () => 'a', (v) => v.matches.filter((m) => m.result).length >= 20)
    expect(consolationOf(early.view)).toHaveLength(0)
    expect(early.view.consolationPending).toBe(true)

    const { view } = playOut(level)
    expect(view.consolationPending).toBe(false)

    const qualified = new Set<PlayerId>()
    for (const group of view.groups.filter((g) => !g.consolation)) {
      for (const row of (view.standings.get(group.id) ?? []).slice(0, 2)) {
        qualified.add(row.playerId)
      }
    }
    const field = new Set(
      view.groups.filter((g) => g.consolation).flatMap((g) => g.playerIds),
    )
    expect(field.size).toBe(8)
    for (const id of field) expect(qualified.has(id)).toBe(false)
  })

  it('runs the same format again — two groups of four, then a bracket', () => {
    const { view } = playOut(makeLevel(config, 16))
    expect(view.groups.filter((g) => g.consolation)).toHaveLength(2)
    expect(consolationOf(view).filter((m) => m.match.stage === 'group')).toHaveLength(12)
    expect(consolationOf(view).filter((m) => m.match.stage !== 'group')).toHaveLength(3)
  })

  it('drops to a knockout when the losers are too few for a group stage', () => {
    // 8 players, 2 groups of 4, top 2 up — only 4 go down, and groupsKnockout needs 6.
    const small: FormatConfig = {
      format: 'groupsKnockout',
      groupCount: 2,
      advancePerGroup: 2,
      consolation: true,
    }
    const { view } = playOut(makeLevel(small, 8))
    expect(view.groups.filter((g) => g.consolation)).toHaveLength(0)
    expect(consolationOf(view)).toHaveLength(3)
  })

  it('draws the same consolation whatever order the field is listed in', () => {
    // The guarantee the canonical sort in `consolationLevel` exists to give: the draw
    // depends on *who* went down, never on the order the tables happened to name them.
    const level = makeLevel(config, 16)
    const field = ['p9', 'p3', 'p14', 'p7', 'p11', 'p2', 'p16', 'p5']
    const asListed = buildFixtures(consolationLevel(level, field)!)
    const shuffled = buildFixtures(consolationLevel(level, [...field].reverse())!)
    expect(shuffled).toEqual(asListed)
  })

  it('is not re-drawn when a correction leaves the same players going down', () => {
    const level = makeLevel(config, 16)
    const { results, view } = playOut(level)
    const wentDown = (v: LevelView) =>
      new Set(v.groups.filter((g) => g.consolation).flatMap((g) => g.playerIds))
    const before = consolationOf(view).map((m) => [m.match.id, m.a, m.b])

    // Any group correction that re-orders a table without changing who came out of it.
    const harmless = view.matches.find((m) => {
      if (m.match.stage !== 'group' || m.match.consolation || !m.result) return false
      const stored = results[m.match.id]
      const flipped = resolveLevel(level, {
        ...results,
        [m.match.id]: { ...stored, result: { kind: 'quick', a: 0, b: 3 } },
      })
      const same = [...wentDown(flipped)].join() === [...wentDown(view)].join()
      return same && flipped.standings.get(m.match.groupId!) !== view.standings.get(m.match.groupId!)
    })!
    expect(harmless).toBeDefined()

    const after = resolveLevel(level, {
      ...results,
      [harmless.match.id]: { ...results[harmless.match.id], result: { kind: 'quick', a: 0, b: 3 } },
    })
    expect(consolationOf(after).map((m) => [m.match.id, m.a, m.b])).toEqual(before)
    expect(after.stale.filter((m) => m.match.consolation)).toHaveLength(0)
  })

  it('flags rather than reassigns when a correction changes who went down', () => {
    const level = makeLevel(config, 16)
    const { results, view } = playOut(level)
    expect(view.stale).toHaveLength(0)

    // Flip a match that decides a qualifying place, so a different player goes down.
    const group = view.groups.find((g) => !g.consolation)!
    const rows = view.standings.get(group.id) ?? []
    const [second, third] = [rows[1].playerId, rows[2].playerId]
    const decider = view.matches.find(
      (m) =>
        m.match.groupId === group.id &&
        m.a.kind === 'player' &&
        m.b.kind === 'player' &&
        [m.a.playerId, m.b.playerId].includes(second) &&
        [m.a.playerId, m.b.playerId].includes(third),
    )!
    const stored = results[decider.match.id]
    const [wasA] = stored.playedBy
    const flipped: Results = {
      ...results,
      [decider.match.id]: {
        ...stored,
        result: wasA === second ? { kind: 'quick', a: 0, b: 3 } : { kind: 'quick', a: 3, b: 0 },
      },
    }

    const after = resolveLevel(level, flipped)
    const swapped = new Set(view.groups.filter((g) => g.consolation).flatMap((g) => g.playerIds))
    const now = new Set(after.groups.filter((g) => g.consolation).flatMap((g) => g.playerIds))
    expect(now).not.toEqual(swapped)
    // Nothing is silently reattributed: the affected results are surfaced instead.
    expect(after.stale.some((m) => m.match.consolation)).toBe(true)
    for (const m of after.stale) expect(m.result).toBeUndefined()
  })

  it('leaves every main-draw match id untouched when it is switched on', () => {
    const off = buildFixtures(makeLevel({ format: 'groupsKnockout', groupCount: 4, advancePerGroup: 2 }, 16))
    const on = buildFixtures(makeLevel(config, 16))
    expect(on.matches.filter((m) => !m.consolation).map((m) => m.id)).toEqual(
      off.matches.map((m) => m.id),
    )
  })
})

describe('consolation — titles and advice', () => {
  it('keeps the plate winner out of the main title', () => {
    const level = makeLevel({ format: 'singleElim', consolation: true }, 8)
    const { view } = playOut(level)

    expect(view.champion).toBeDefined()
    expect(view.consolationChampion).toBeDefined()
    expect(view.consolationChampion).not.toBe(view.champion)
    expect(view.complete).toBe(true)

    const tournament: Tournament = {
      id: 't1',
      name: 'night',
      date: '2026-09-19',
      scoreMode: 'quick',
      tableCount: 2,
      levels: [level],
      players: players(8).map((id) => ({ id, name: id })),
      results: playOut(level).results,
      tableAssignments: {},
      createdAt: 0,
      updatedAt: 0,
    }
    // The consolation winner played real matches, and they count — but not as a title.
    const plate = playerStats([tournament], view.consolationChampion!)
    expect(plate.titles).toBe(0)
    expect(plate.played).toBeGreaterThan(1)
    expect(playerStats([tournament], view.champion!).titles).toBe(1)
  })

  it('counts the second competition in the duration advice', () => {
    const plain = shapeOf({ format: 'singleElim' }, 8, 5)
    const withPlate = shapeOf({ format: 'singleElim', consolation: true }, 8, 5)
    expect(plain.matchCount).toBe(7)
    // 2n-4: two short of double elimination — the grand final we do not play, and the
    // runner-up, who keeps second place instead of going down for a second prize.
    expect(withPlate.matchCount).toBe(12)
    expect(withPlate.minMatchesPerPlayer).toBe(2)
    expect(withPlate.estimatedMinutes).toBeGreaterThan(plain.estimatedMinutes)

    const groups: FormatConfig = { format: 'groupsKnockout', groupCount: 4, advancePerGroup: 2 }
    expect(shapeOf(groups, 16, 5).matchCount).toBe(31)
    expect(shapeOf({ ...groups, consolation: true }, 16, 5).matchCount).toBe(46)
  })

  it('agrees with the fixtures about how big the night is', () => {
    for (const config of [
      { format: 'singleElim', consolation: true } as const,
      { format: 'groupsKnockout', groupCount: 4, advancePerGroup: 2, consolation: true } as const,
    ]) {
      const level = makeLevel(config, 16)
      const { view } = playOut(level)
      expect(view.total).toBe(shapeOf(config, 16, 5).matchCount)
    }
  })

  it('offers nothing to a field that eliminates nobody', () => {
    expect(consolationFieldSize({ format: 'roundRobin' }, 12)).toBe(0)
    expect(consolationConfig({ format: 'roundRobin' }, 0)).toBeNull()
    expect(consolationFieldSize({ format: 'singleElim' }, 3)).toBe(1)
    expect(consolationConfig({ format: 'singleElim' }, 1)).toBeNull()

    const level = makeLevel({ format: 'roundRobin' }, 6)
    expect(resolveLevel(level, {}).consolationPending).toBe(false)
  })
})
