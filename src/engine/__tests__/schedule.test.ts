import { describe, expect, it } from 'vitest'
import {
  circleRounds,
  deciderSeeds,
  scheduleGroup,
  seedByRank,
  type SeedPair,
} from '../schedule'
import { buildFixtures, levelDrawOrder, resolveLevel } from '../resolve'
import { generateGroupMatches, singleGroup } from '../formats/roundRobin'
import type { FormatConfig, Level, Match, PlayerId } from '../types'

const players = (n: number): PlayerId[] => Array.from({ length: n }, (_, i) => `p${i + 1}`)

/** p1 is the strongest, and every one after it is 50 points weaker. */
function ladder(n: number): Record<PlayerId, number> {
  return Object.fromEntries(players(n).map((id, i) => [id, 2000 - i * 50]))
}

function makeLevel(
  config: FormatConfig,
  playerCount: number,
  ranks?: Record<PlayerId, number>,
  seed = 'SEED1234',
): Level {
  return {
    id: 'L1',
    name: 'A',
    playerIds: players(playerCount),
    config,
    bestOf: 5,
    seed,
    withdrawn: [],
    ranks,
  }
}

const flat = (size: number, advance: number): SeedPair[] =>
  scheduleGroup(size, advance).rounds.flat()

const samePair = (x: SeedPair, y: SeedPair): boolean =>
  (x[0] === y[0] && x[1] === y[1]) || (x[0] === y[1] && x[1] === y[0])

const shares = (x: SeedPair, y: SeedPair): boolean =>
  x[0] === y[0] || x[0] === y[1] || x[1] === y[0] || x[1] === y[1]

const key = (pair: SeedPair): string =>
  pair[0] < pair[1] ? `${pair[0]}v${pair[1]}` : `${pair[1]}v${pair[0]}`

function backToBackIn(order: readonly SeedPair[]): number {
  let count = 0
  for (let i = 1; i < order.length; i++) if (shares(order[i - 1], order[i])) count++
  return count
}

/** Every unordered pair of 1..size, the full round robin a plan has to cover. */
function everyPair(size: number): SeedPair[] {
  const pairs: SeedPair[] = []
  for (let a = 1; a <= size; a++) for (let b = a + 1; b <= size; b++) pairs.push([a, b])
  return pairs
}

function permute<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()]
  return items.flatMap((item, i) =>
    permute([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  )
}

/**
 * The fewest back-to-back matches any ordering of the whole group can manage, found
 * by trying all of them. Only usable for the smallest groups — six matches is 720
 * orderings and fifteen is more than a thousand billion — which is exactly why the
 * scheduler searches over rounds instead.
 */
function fewestPossible(size: number, decider?: SeedPair): number {
  let best = Infinity
  for (const order of permute(everyPair(size))) {
    if (decider && !samePair(order[order.length - 1], decider)) continue
    best = Math.min(best, backToBackIn(order))
  }
  return best
}

describe('circle method', () => {
  it('pairs every seat exactly once', () => {
    for (const count of [2, 3, 4, 5, 6, 7, 8, 9]) {
      const pairs = circleRounds(count)
        .flat()
        .map(([a, b]) => key([a + 1, b + 1]))
      expect(pairs).toHaveLength((count * (count - 1)) / 2)
      expect(new Set(pairs).size).toBe(pairs.length)
    }
  })

  it('never seats a player twice in one round', () => {
    for (const count of [5, 8, 11]) {
      for (const round of circleRounds(count)) {
        const seats = round.flat()
        expect(new Set(seats).size).toBe(seats.length)
      }
    }
  })

  it('has nothing to arrange below two players', () => {
    expect(circleRounds(0)).toEqual([])
    expect(circleRounds(1)).toEqual([])
    expect(circleRounds(2)).toEqual([[[0, 1]]])
  })
})

describe('seeding a group by rank', () => {
  it('orders the group by points, strongest first', () => {
    const ranks = { a: 900, b: 1500, c: 1200 }
    expect(seedByRank(['a', 'b', 'c'], ranks)).toEqual(['b', 'c', 'a'])
  })

  it('declines a group where anyone is unranked', () => {
    expect(seedByRank(['a', 'b'], { a: 900 })).toBeUndefined()
    expect(seedByRank(['a', 'b'], undefined)).toBeUndefined()
    expect(seedByRank([], { a: 900 })).toBeUndefined()
  })

  it('reads the ranks rather than the order it was handed', () => {
    const ranks = { a: 900, b: 1500, c: 1200 }
    // A hand-arranged draw hands the players over in any order at all; the seeding
    // has to come out the same, or the closing match would depend on the seating.
    expect(seedByRank(['c', 'a', 'b'], ranks)).toEqual(['b', 'c', 'a'])
  })

  it('leaves players level on points in the order the draw put them', () => {
    const ranks = { a: 1000, b: 1000, c: 1000 }
    expect(seedByRank(['c', 'a', 'b'], ranks)).toEqual(['c', 'a', 'b'])
  })

  it('keeps a rank of zero, which is a rank and not an absence', () => {
    expect(seedByRank(['a', 'b'], { a: 0, b: 1200 })).toEqual(['b', 'a'])
  })
})

describe('which match decides the group', () => {
  it('is the top two when one player goes through', () => {
    expect(deciderSeeds(4, 1)).toEqual([1, 2])
  })

  it('is seeds two and three when two go through', () => {
    expect(deciderSeeds(4, 2)).toEqual([2, 3])
  })

  it('is nothing once the field is too small to eliminate anyone', () => {
    expect(deciderSeeds(2, 2)).toBeUndefined()
    expect(deciderSeeds(3, 3)).toBeUndefined()
  })

  it('is nothing when more than two go through', () => {
    expect(deciderSeeds(6, 3)).toBeUndefined()
  })
})

describe('scheduling a group — the hard constraints', () => {
  it('H1: plays every pair exactly once', () => {
    for (let size = 2; size <= 12; size++) {
      for (const advance of [1, 2, 3, 4]) {
        const order = flat(size, advance).map(key)
        expect(order).toHaveLength((size * (size - 1)) / 2)
        expect(new Set(order).size).toBe(order.length)
      }
    }
  })

  it('H2: never puts a player in one batch twice, so a batch can share the tables', () => {
    for (let size = 2; size <= 12; size++) {
      for (const advance of [1, 2, 3, 4]) {
        for (const round of scheduleGroup(size, advance).rounds) {
          const seeds = round.flat()
          expect(new Set(seeds).size).toBe(seeds.length)
        }
      }
    }
  })

  it('H3: closes on the top two when one player goes through', () => {
    for (let size = 2; size <= 12; size++) {
      const order = flat(size, 1)
      expect(order[order.length - 1].slice().sort((a, b) => a - b)).toEqual([1, 2])
    }
  })

  it('H3: closes on seeds two and three when two go through', () => {
    for (let size = 3; size <= 12; size++) {
      const order = flat(size, 2)
      expect(order[order.length - 1].slice().sort((a, b) => a - b)).toEqual([2, 3])
    }
  })

  it('leaves the closing match free when nothing is riding on it', () => {
    // Three of five going through has no single deciding match to protect, so the
    // plan is free to close wherever the other objectives take it.
    const order = flat(5, 3)
    expect(order).toHaveLength(10)
    expect(new Set(order.map(key)).size).toBe(10)
  })

  it('has nothing to schedule below two players', () => {
    expect(scheduleGroup(1, 1)).toEqual({ rounds: [], backToBack: 0 })
    expect(scheduleGroup(0, 1)).toEqual({ rounds: [], backToBack: 0 })
  })

  it('schedules two players as their single match', () => {
    expect(scheduleGroup(2, 1).rounds).toEqual([[[1, 2]]])
  })
})

describe('scheduling a group — the running order', () => {
  it('gives nobody two matches in a row from five players up', () => {
    for (let size = 5; size <= 12; size++) {
      for (const advance of [1, 2, 3]) {
        expect(scheduleGroup(size, advance).backToBack).toBe(0)
      }
    }
  })

  it('concedes the two that three players make unavoidable', () => {
    // Each player is in two of the three matches, so by pigeonhole somebody plays
    // consecutively — and in fact every adjacent pair of matches in a group of three
    // shares a player, so both boundaries are repeats whatever the order.
    expect(scheduleGroup(3, 1).backToBack).toBe(2)
    expect(fewestPossible(3, [1, 2])).toBe(2)
  })

  it('concedes the two that four players make unavoidable', () => {
    // Worth pinning down, because it is easy to assume one is achievable. Among the
    // six matches each has exactly one it shares no player with, so at most three of
    // the five adjacencies can be clean and at least two must be repeats.
    expect(scheduleGroup(4, 1).backToBack).toBe(2)
    expect(scheduleGroup(4, 2).backToBack).toBe(2)
    expect(fewestPossible(4, [1, 2])).toBe(2)
    expect(fewestPossible(4, [2, 3])).toBe(2)
  })

  it('matches the best any ordering at all could do, for the sizes that can be proved', () => {
    for (const [size, advance] of [
      [3, 1],
      [3, 2],
      [4, 1],
      [4, 2],
    ] as const) {
      const decider = deciderSeeds(size, advance)
      expect(scheduleGroup(size, advance).backToBack).toBe(fewestPossible(size, decider))
    }
  })

  it('hands a forced repeat to the weaker player rather than the stronger', () => {
    // Three players cannot avoid two repeats, but it can avoid giving one to the
    // player the closing match belongs to.
    const order = flat(3, 1)
    for (let i = 1; i < order.length; i++) {
      expect(shares(order[i - 1], order[i]) && order[i].includes(1) && order[i - 1].includes(1))
        .toBe(false)
    }
    expect(order.map(key)).toEqual(['1v3', '2v3', '1v2'])
  })

  it('reproduces the published example for three players and two qualifiers', () => {
    expect(flat(3, 2).map(key)).toEqual(['1v2', '1v3', '2v3'])
  })

  it('plans the same group the same way every time', () => {
    for (let size = 2; size <= 10; size++) {
      expect(scheduleGroup(size, 2)).toEqual(scheduleGroup(size, 2))
    }
  })
})

describe('scheduling a group — a published order', () => {
  const order: SeedPair[] = [
    [1, 2],
    [3, 4],
    [1, 3],
    [2, 4],
    [1, 4],
    [2, 3],
  ]

  it('takes precedence over anything the generator would produce', () => {
    const planned = scheduleGroup(4, 2, { '4:2': order })
    expect(planned.rounds.flat()).toEqual(order)
    expect(planned.rounds).toEqual([
      [
        [1, 2],
        [3, 4],
      ],
      [
        [1, 3],
        [2, 4],
      ],
      [
        [1, 4],
        [2, 3],
      ],
    ])
  })

  it('applies only to the group size and qualifier count it was published for', () => {
    expect(scheduleGroup(4, 1, { '4:2': order }).rounds.flat()).not.toEqual(order)
  })

  it('is ignored unless it is a whole round robin', () => {
    // A table missing a match, or naming one twice, is a misconfiguration rather than
    // a running order; the generator takes over rather than a group being served
    // five sixths of a schedule.
    const generated = scheduleGroup(4, 2).rounds
    expect(scheduleGroup(4, 2, { '4:2': order.slice(0, 5) }).rounds).toEqual(generated)
    const repeated: SeedPair[] = [...order.slice(0, 5), [1, 2]]
    expect(scheduleGroup(4, 2, { '4:2': repeated }).rounds).toEqual(generated)
  })
})

const pairOf = (m: Match): string => {
  const a = m.a.kind === 'player' ? m.a.playerId : '?'
  const b = m.b.kind === 'player' ? m.b.playerId : '?'
  return `${m.id}:${a}v${b}`
}

const closingPair = (matches: readonly Match[], groupId: string): string[] => {
  const inGroup = matches.filter((m) => m.groupId === groupId)
  const last = inGroup[inGroup.length - 1]
  return [
    last.a.kind === 'player' ? last.a.playerId : '?',
    last.b.kind === 'player' ? last.b.playerId : '?',
  ].sort()
}

describe('the running order inside a tournament', () => {
  it('renames not one match: the plan changes the sequence and nothing else', () => {
    const level = makeLevel({ format: 'roundRobin' }, 6, ladder(6))
    const drawn = generateGroupMatches(
      singleGroup(level.id, level.name, levelDrawOrder(level)),
    )
    const planned = buildFixtures(level).matches

    // Every match, its id and the two players standing at it, are the same set. This
    // is the property that lets the plan exist at all: stored results are keyed by
    // match id, so a running order that renamed anything would detach them.
    expect(planned.map(pairOf).sort()).toEqual(drawn.map(pairOf).sort())
    // ...and the sequence really did change, or the test above would prove nothing.
    expect(planned.map((m) => m.id)).not.toEqual(drawn.map((m) => m.id))
  })

  it('keeps the draw order for a group where anyone is unranked', () => {
    const ranks = ladder(6)
    delete ranks.p4
    const level = makeLevel({ format: 'roundRobin' }, 6, ranks)
    const drawn = generateGroupMatches(
      singleGroup(level.id, level.name, levelDrawOrder(level)),
    )
    expect(buildFixtures(level).matches).toEqual(drawn)
  })

  it('closes a ranked round robin on the two strongest players', () => {
    const level = makeLevel({ format: 'roundRobin' }, 7, ladder(7))
    const { groups, matches } = buildFixtures(level)
    expect(closingPair(matches, groups[0].id)).toEqual(['p1', 'p2'])
  })

  it('closes every group of a ranked group stage on its own second and third seeds', () => {
    const level = makeLevel(
      { format: 'groupsKnockout', groupCount: 2, advancePerGroup: 2 },
      8,
      ladder(8),
    )
    const { groups, matches } = buildFixtures(level)
    expect(groups).toHaveLength(2)
    // The draw is banded, so group A is the top four and group B the next four; each
    // one's own seeds 2 and 3 close it.
    expect(closingPair(matches, groups[0].id)).toEqual(['p2', 'p3'])
    expect(closingPair(matches, groups[1].id)).toEqual(['p6', 'p7'])
  })

  it('plans a group stage group by group, leaving a part-ranked group alone', () => {
    const ranks = ladder(8)
    delete ranks.p8
    const level = makeLevel(
      { format: 'groupsKnockout', groupCount: 2, advancePerGroup: 2 },
      8,
      ranks,
    )
    const { groups, matches } = buildFixtures(level)
    // Group A is fully ranked and is planned; group B holds the unranked player and
    // keeps the order the draw gave it.
    expect(closingPair(matches, groups[0].id)).toEqual(['p2', 'p3'])
    const drawnB = generateGroupMatches(groups[1])
    expect(matches.filter((m) => m.groupId === groups[1].id)).toEqual(drawnB)
  })

  it('seeds off the ranks, so arranging the draw by hand does not move the decider', () => {
    const level = makeLevel({ format: 'roundRobin' }, 5, ladder(5))
    const byHand: Level = { ...level, manualOrder: ['p5', 'p3', 'p1', 'p4', 'p2'] }
    const { groups, matches } = buildFixtures(byHand)
    expect(closingPair(matches, groups[0].id)).toEqual(['p1', 'p2'])
  })

  it('leaves a stored result attached to its match', () => {
    const level = makeLevel({ format: 'roundRobin' }, 6, ladder(6))
    const first = buildFixtures(level).matches[0]
    const playedBy: [PlayerId, PlayerId] = [
      first.a.kind === 'player' ? first.a.playerId : '',
      first.b.kind === 'player' ? first.b.playerId : '',
    ]
    const view = resolveLevel(level, {
      [first.id]: { result: { kind: 'quick', a: 3, b: 1 }, playedBy, enteredAt: 0 },
    })
    expect(view.stale).toHaveLength(0)
    expect(view.played).toBe(1)
  })

  it('gives the tables a full batch of matches to start on', () => {
    const level = makeLevel({ format: 'roundRobin' }, 8, ladder(8))
    const matches = buildFixtures(level).matches
    // Whatever the table count, the matches at the head of the list can all begin at
    // once — which is what "up next" hands the manager.
    const opening = matches.filter((m) => m.round === 0)
    const seats = opening.flatMap((m) => [
      m.a.kind === 'player' ? m.a.playerId : '',
      m.b.kind === 'player' ? m.b.playerId : '',
    ])
    expect(opening).toHaveLength(4)
    expect(new Set(seats).size).toBe(8)
  })
})
