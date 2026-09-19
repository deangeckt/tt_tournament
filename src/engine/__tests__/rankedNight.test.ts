import { describe, expect, it } from 'vitest'
import { buildFixtures, levelDrawOrder, resolveLevel, type LevelView } from '../resolve'
import { seedByRank } from '../schedule'
import { tally } from '../result'
import { ranksOrNone } from '../../store/ranks'
import type {
  GameScore,
  Level,
  MatchId,
  MatchResult,
  Player,
  PlayerId,
  ScoreMode,
  StoredResult,
} from '../types'

/**
 * One whole club night, played from the draw to the champion.
 *
 * Every other test here takes one piece apart; this one runs the thing the way the app
 * does — freeze the ranks the way the wizard freezes them, derive the draw, then take
 * the match at the head of "up next", enter its score, and do it again until nobody is
 * waiting. That loop is the real test of the running order: it is the order the cards
 * come off the list in, so if the plan were wrong the night would be played wrong.
 *
 * Two levels, because a club night is two levels: a round robin of five where the
 * title comes down to the closing match, and a group stage of eight that leaves one
 * group in a three-way cycle for the ITTF chain to unpick before anyone can go
 * through.
 */

const club: Player[] = [
  // דרג א׳ — the five strongest in the club.
  { id: 'amit', name: 'עמית גורן', rank: 1747.6 },
  { id: 'ron', name: 'רון אלבז', rank: 1688.2 },
  { id: 'daniel', name: 'דניאל כהן', rank: 1601.0 },
  { id: 'itai', name: 'איתי לוי', rank: 1544.5 },
  { id: 'nir', name: 'ניר אבידן', rank: 1498.3 },
  // דרג ב׳ — eight more, including one registered player who has not scored on his
  // ranking yet. Zero points is a rank, not an absence, so his group is planned too.
  { id: 'noam', name: 'נועם פרץ', rank: 1402.7 },
  { id: 'uri', name: 'אורי שמש', rank: 1355.9 },
  { id: 'guy', name: 'גיא ברק', rank: 1301.4 },
  { id: 'tal', name: 'טל אדרי', rank: 1288.0 },
  { id: 'lior', name: 'ליאור מזרחי', rank: 1210.6 },
  { id: 'ido', name: 'עידו נחום', rank: 1188.2 },
  { id: 'shai', name: 'שי רוזן', rank: 1095.4 },
  { id: 'yonatan', name: 'יונתן קידר', rank: 0.0 },
]

const nameOf = (id: PlayerId): string => club.find((p) => p.id === id)?.name ?? id
const rankOf = (id: PlayerId): number => club.find((p) => p.id === id)?.rank ?? 0

/** Built exactly the way the wizard builds one: the ranks are copied on at birth. */
function enter(
  id: string,
  name: string,
  playerIds: PlayerId[],
  config: Level['config'],
  seed: string,
): Level {
  return {
    id,
    name,
    playerIds,
    config,
    bestOf: 5,
    seed,
    withdrawn: [],
    ranks: ranksOrNone(playerIds, club),
  }
}

// Entered in the order the manager reads them off the sign-up sheet, which is nobody's
// idea of strongest-first. The draw is what sorts them.
const levelA = enter(
  'LA',
  'דרג א׳',
  ['itai', 'amit', 'nir', 'daniel', 'ron'],
  { format: 'roundRobin' },
  'NIGHT-A1',
)

const levelB = enter(
  'LB',
  'דרג ב׳',
  ['shai', 'noam', 'yonatan', 'guy', 'lior', 'uri', 'ido', 'tal'],
  { format: 'groupsKnockout', groupCount: 2, advancePerGroup: 2 },
  'NIGHT-B1',
)

type Leg = 'group' | 'knockout'

const pair = (a: PlayerId, b: PlayerId, leg: Leg): string =>
  `${a < b ? `${a}|${b}` : `${b}|${a}`}#${leg}`

/**
 * The night's results, decided in advance so the whole test is deterministic.
 *
 * Keyed by the leg as well as the two players, because the same two people really can
 * meet twice in one night: two who came out of one group can meet again in the final,
 * and that final is a different match with a different result.
 */
const sheet = new Map<string, { winner: PlayerId; games: [number, number] }>()
const wins = (winner: PlayerId, loser: PlayerId, taken = 1, leg: Leg = 'group') =>
  sheet.set(pair(winner, loser, leg), { winner, games: [3, taken] })

// דרג א׳: the top two both arrive at the closing match unbeaten, and the second seed
// takes the title off the first in five games.
wins('ron', 'nir', 1)
wins('daniel', 'itai', 0)
wins('amit', 'nir', 0)
wins('ron', 'daniel', 2)
wins('amit', 'itai', 1)
wins('daniel', 'nir', 1)
wins('ron', 'itai', 0)
wins('amit', 'daniel', 1)
wins('itai', 'nir', 2)
wins('ron', 'amit', 2)

// דרג ב׳, group A: every one of the top three beats one of the others and loses to the
// other, so the group ends in a cycle that only game ratio can separate.
wins('noam', 'uri', 0)
wins('guy', 'tal', 0)
wins('guy', 'noam', 1)
wins('uri', 'tal', 0)
wins('noam', 'tal', 0)
wins('uri', 'guy', 2)

// Group B settles itself, but not until its own closing match.
wins('lior', 'ido', 1)
wins('shai', 'yonatan', 0)
wins('lior', 'shai', 0)
wins('ido', 'yonatan', 0)
wins('lior', 'yonatan', 0)
wins('ido', 'shai', 1)

// The knockout, where נועם takes back the group match גיא won off him — the rematch
// the bracket kept apart until the final.
wins('noam', 'ido', 1, 'knockout')
wins('guy', 'lior', 2, 'knockout')
wins('noam', 'guy', 2, 'knockout')

/** A plausible scoreline for a match won in `aWins` games to `bWins`. */
function games(aWins: number, bWins: number): GameScore[] {
  const played: GameScore[] = []
  let a = aWins
  let b = bWins
  while (a > 0 || b > 0) {
    if (a > 0) {
      played.push({ a: 11, b: 7 })
      a--
    }
    if (b > 0) {
      played.push({ a: 8, b: 11 })
      b--
    }
  }
  return played
}

function scoreOf(a: PlayerId, b: PlayerId, leg: Leg, mode: ScoreMode): MatchResult {
  const outcome = sheet.get(pair(a, b, leg))
  if (!outcome) throw new Error(`no ${leg} result scripted for ${nameOf(a)} v ${nameOf(b)}`)
  const [won, lost] = outcome.games
  const aGames = outcome.winner === a ? won : lost
  const bGames = outcome.winner === a ? lost : won
  return mode === 'quick'
    ? { kind: 'quick', a: aGames, b: bGames }
    : { kind: 'detailed', games: games(aGames, bGames) }
}

interface Played {
  view: LevelView
  results: Record<MatchId, StoredResult>
  /** The matches in the order they came off "up next", as the manager saw them. */
  order: MatchId[]
  /** Set if any result ever came back flagged while the night was being played. */
  everStale: boolean
}

/**
 * Play a level the way the screen does: resolve, take the match at the head of the
 * ready list, enter its score, resolve again.
 *
 * Nothing here knows the running order — it just keeps taking whatever is in front of
 * it, which is precisely what makes the order it ends up playing in worth asserting.
 */
function play(level: Level, mode: ScoreMode): Played {
  const results: Record<MatchId, StoredResult> = {}
  const order: MatchId[] = []
  let everStale = false
  let view = resolveLevel(level, results)

  for (let guard = 0; guard < 500; guard++) {
    everStale = everStale || view.stale.length > 0
    const next = view.matches.find((m) => m.playable && !m.result)
    if (!next) break
    if (next.a.kind !== 'player' || next.b.kind !== 'player') break

    const playedBy: [PlayerId, PlayerId] = [next.a.playerId, next.b.playerId]
    const leg: Leg = next.match.stage === 'group' ? 'group' : 'knockout'
    results[next.match.id] = {
      result: scoreOf(playedBy[0], playedBy[1], leg, mode),
      playedBy,
      enteredAt: order.length,
    }
    order.push(next.match.id)
    view = resolveLevel(level, results)
  }

  return { view, results, order, everStale }
}

const nightA = play(levelA, 'quick')
const nightB = play(levelB, 'detailed')

/**
 * Print the night as a score sheet.
 *
 * Assertions prove the plan is right; this is so it can be *read*. Matches are named
 * by seed rather than by player so the two rules the plan exists for can be checked
 * by eye — no number on two consecutive lines, and the deciding pair on the last one
 * — and so that a terminal, which reorders Hebrew and leaves the digits where they
 * are, cannot garble the part that matters.
 */
function scoreSheet(level: Level, played: Played, format: string): string {
  const out: string[] = ['', `━━━ ${level.name} · ${format} · ${level.playerIds.length} players`]

  for (const group of played.view.groups) {
    const seeds = seedsOf(level, group.playerIds)
    const seated = [...seeds.entries()].sort((x, y) => x[1] - y[1])
    // A round robin is one group named after the level, so naming it again is noise.
    out.push('', played.view.groups.length > 1 ? `    group ${group.name}` : '    the field')
    for (const [id, seed] of seated) {
      out.push(`      seed ${seed} = ${nameOf(id)} (${rankOf(id).toFixed(1)})`)
    }

    const inGroup = played.order
      .map((id) => played.view.byId.get(id)!)
      .filter((m) => m.match.groupId === group.id)
    out.push(`      played in this order — ${backToBackIn(played, group.id)} back-to-back`)
    inGroup.forEach((m, i) => {
      const [a, b] = playersIn(m)
      const t = tally(m.result!, level.bestOf)
      const won = t.winner === 'a' ? a : b
      const last = i === inGroup.length - 1 ? '   <- the decider' : ''
      out.push(
        `      ${String(i + 1).padStart(2)}.  seed ${seeds.get(a)} v seed ${seeds.get(b)}` +
          `   ${t.gamesA}:${t.gamesB}   won by seed ${seeds.get(won)}${last}`,
      )
    })

    out.push('      final table')
    for (const row of played.view.standings.get(group.id) ?? []) {
      const how = row.tiebreakReason ? `  (${row.tiebreakReason})` : ''
      out.push(
        `        ${row.rank}. ${row.won}-${row.lost}  ${row.matchPoints} pts  ` +
          `${row.gamesFor}:${row.gamesAgainst}  ${nameOf(row.playerId)}${how}`,
      )
    }
  }

  const bracket = played.order
    .map((id) => played.view.byId.get(id)!)
    .filter((m) => m.match.stage !== 'group')
  if (bracket.length > 0) {
    out.push('', '    knockout')
    for (const m of bracket) {
      const [a, b] = playersIn(m)
      const t = tally(m.result!, level.bestOf)
      out.push(`      ${t.gamesA}:${t.gamesB}   ${nameOf(a)} v ${nameOf(b)}`)
    }
  }

  out.push('', `    champion: ${nameOf(played.view.champion ?? '')}`, '')
  return out.join('\n')
}

/** The seed a player was given inside their own group, 1 = strongest. */
function seedsOf(level: Level, playerIds: readonly PlayerId[]): Map<PlayerId, number> {
  const seeded = seedByRank(playerIds, level.ranks) ?? []
  return new Map(seeded.map((id, i) => [id, i + 1]))
}

/** One line per match, in the order it was played. */
function runningOrder(level: Level, played: Played, groupId: string): string[] {
  const group = played.view.groups.find((g) => g.id === groupId)
  const seeds = seedsOf(level, group?.playerIds ?? [])
  return played.order
    .map((id) => played.view.byId.get(id)!)
    .filter((m) => m.match.groupId === groupId)
    .map((m) => {
      const a = m.a.kind === 'player' ? m.a.playerId : ''
      const b = m.b.kind === 'player' ? m.b.playerId : ''
      return `(${seeds.get(a)}) ${nameOf(a)}  v  (${seeds.get(b)}) ${nameOf(b)}`
    })
}

const playersIn = (m: { a: { kind: string }; b: { kind: string } }): string[] => {
  const slot = (s: { kind: string }) => (s as { playerId?: string }).playerId ?? ''
  return [slot(m.a), slot(m.b)]
}

function backToBackIn(played: Played, groupId: string): number {
  const inGroup = played.order
    .map((id) => played.view.byId.get(id)!)
    .filter((m) => m.match.groupId === groupId)
  let count = 0
  for (let i = 1; i < inGroup.length; i++) {
    const before = new Set(playersIn(inGroup[i - 1]))
    if (playersIn(inGroup[i]).some((id) => before.has(id))) count++
  }
  return count
}

// The night, written out where it can be looked at — `npm run night`. Straight to
// stdout because the runner swallows `console.log`, and off by default because a full
// `npm test` should report on tests and nothing else.
if (process.env.npm_lifecycle_event === 'night' || process.env.TT_SCORESHEET === '1') {
  process.stdout.write(scoreSheet(levelA, nightA, 'round robin'))
  process.stdout.write(scoreSheet(levelB, nightB, 'groups then knockout'))
}

describe('a ranked club night — דרג א׳, five players, round robin', () => {
  it('sorts the sign-up sheet into a draw by ranking points', () => {
    expect(levelA.ranks).toEqual({
      amit: 1747.6,
      ron: 1688.2,
      daniel: 1601.0,
      itai: 1544.5,
      nir: 1498.3,
    })
    expect(levelDrawOrder(levelA)).toEqual(['amit', 'ron', 'daniel', 'itai', 'nir'])
  })

  it('plays the ten matches in the planned order, and this is that order', () => {
    // Read it as the manager does, down the list. Nobody's name appears on two
    // consecutive lines, and the two strongest players close the night.
    expect(runningOrder(levelA, nightA, 'LA:g0')).toEqual([
      '(2) רון אלבז  v  (5) ניר אבידן',
      '(3) דניאל כהן  v  (4) איתי לוי',
      '(5) ניר אבידן  v  (1) עמית גורן',
      '(3) דניאל כהן  v  (2) רון אלבז',
      '(1) עמית גורן  v  (4) איתי לוי',
      '(5) ניר אבידן  v  (3) דניאל כהן',
      '(2) רון אלבז  v  (4) איתי לוי',
      '(3) דניאל כהן  v  (1) עמית גורן',
      '(4) איתי לוי  v  (5) ניר אבידן',
      '(1) עמית גורן  v  (2) רון אלבז',
    ])
  })

  it('never asks anyone to play two matches in a row', () => {
    expect(backToBackIn(nightA, 'LA:g0')).toBe(0)
  })

  it('closes the night on the match that decides it', () => {
    const last = nightA.view.byId.get(nightA.order[nightA.order.length - 1])!
    expect(playersIn(last).sort()).toEqual(['amit', 'ron'])
    // And it was genuinely still open: both of them came into it unbeaten.
    const before = { ...nightA.results }
    delete before[last.match.id]
    const standing = resolveLevel(levelA, before).standings.get('LA:g0')!
    expect(standing.slice(0, 2).map((row) => [row.playerId, row.won])).toEqual([
      ['amit', 3],
      ['ron', 3],
    ])
  })

  it('finishes with a full table and the champion the last match produced', () => {
    expect(nightA.everStale).toBe(false)
    expect(nightA.view.complete).toBe(true)
    expect(nightA.view.played).toBe(10)
    expect(nightA.view.champion).toBe('ron')

    const table = nightA.view.standings.get('LA:g0')!
    expect(table.map((row) => `${row.rank}. ${nameOf(row.playerId)} ${row.won}-${row.lost}`)).toEqual([
      '1. רון אלבז 4-0',
      '2. עמית גורן 3-1',
      '3. דניאל כהן 2-2',
      '4. איתי לוי 1-3',
      '5. ניר אבידן 0-4',
    ])
  })
})

describe('a ranked club night — דרג ב׳, eight players, groups then knockout', () => {
  const groupA = 'LB:g0'
  const groupB = 'LB:g1'

  it('bands the eight into two groups of one standard each', () => {
    const groups = buildFixtures(levelB).groups
    expect(groups.map((g) => g.playerIds.map(nameOf))).toEqual([
      ['נועם פרץ', 'אורי שמש', 'גיא ברק', 'טל אדרי'],
      ['ליאור מזרחי', 'עידו נחום', 'שי רוזן', 'יונתן קידר'],
    ])
    // Every player in the stronger group outranks every player in the weaker one.
    const [strong, weak] = groups
    const floor = Math.min(...strong.playerIds.map(rankOf))
    expect(Math.max(...weak.playerIds.map(rankOf))).toBeLessThan(floor)
  })

  it('plans each group on its own, and closes both on their second and third seeds', () => {
    expect(runningOrder(levelB, nightB, groupA)).toEqual([
      '(1) נועם פרץ  v  (2) אורי שמש',
      '(3) גיא ברק  v  (4) טל אדרי',
      '(3) גיא ברק  v  (1) נועם פרץ',
      '(2) אורי שמש  v  (4) טל אדרי',
      '(1) נועם פרץ  v  (4) טל אדרי',
      '(2) אורי שמש  v  (3) גיא ברק',
    ])
    expect(runningOrder(levelB, nightB, groupB).at(-1)).toBe(
      '(2) עידו נחום  v  (3) שי רוזן',
    )
  })

  it('concedes the two repeats a group of four cannot avoid, and no more', () => {
    expect(backToBackIn(nightB, groupA)).toBe(2)
    expect(backToBackIn(nightB, groupB)).toBe(2)
  })

  it('leaves group A in a three-way cycle and separates it on game ratio', () => {
    const table = nightB.view.standings.get(groupA)!
    expect(
      table.map((row) => `${row.rank}. ${nameOf(row.playerId)} ${row.matchPoints}pts ${row.gamesFor}:${row.gamesAgainst}`),
    ).toEqual([
      '1. נועם פרץ 5pts 7:3',
      '2. גיא ברק 5pts 8:4',
      '3. אורי שמש 5pts 6:5',
      '4. טל אדרי 3pts 0:9',
    ])
    // The order is not the one those whole-group totals suggest — גיא has the best of
    // them and finishes second. The chain counts only the matches between the three,
    // where נועם is 4:3, גיא 5:4 and אורי 3:5.
    // Level on match points, level head-to-head, and only then separated — and the
    // table says which criterion did it, because the manager will be asked.
    expect(table.slice(0, 3).map((row) => row.tiebreakReason)).toEqual([
      'gameRatio',
      'gameRatio',
      'gameRatio',
    ])
  })

  it('sends the two who came through each group into the bracket', () => {
    const semiFinals = nightB.view.matches.filter(
      (m) => m.match.stage !== 'group' && m.match.round === 0,
    )
    expect(semiFinals.map((m) => playersIn(m).map(nameOf))).toEqual([
      ['נועם פרץ', 'עידו נחום'],
      ['ליאור מזרחי', 'גיא ברק'],
    ])
    // Two players out of one group can only meet again in the final, never before it.
    for (const semi of semiFinals) {
      const groups = playersIn(semi).map(
        (id) => nightB.view.groups.find((g) => g.playerIds.includes(id))?.id,
      )
      expect(groups[0]).not.toBe(groups[1])
    }
  })

  it('runs to a champion with every result still attached to its match', () => {
    expect(nightB.everStale).toBe(false)
    expect(nightB.view.stale).toHaveLength(0)
    expect(nightB.view.complete).toBe(true)
    expect(nightB.view.played).toBe(15)
    expect(nightB.view.champion).toBe('noam')
  })
})

describe('a ranked club night — what the plan cost', () => {
  it('names every match the same whether or not the order was planned', () => {
    // The night above was played entirely through planned ids. Generating the same two
    // levels with the planner out of the picture has to produce the very same names,
    // or every result stored tonight would come back flagged after an update.
    for (const level of [levelA, levelB]) {
      const planned = buildFixtures(level).matches
      const unplanned = buildFixtures({ ...level, ranks: undefined })
      // Without ranks the draw itself changes, so compare the *shape* of the naming:
      // one id per match, all distinct, and every one derived from a group and a
      // drawn position rather than from where the match landed in the running order.
      expect(new Set(planned.map((m) => m.id)).size).toBe(planned.length)
      expect(planned.map((m) => m.id).sort()).toEqual(
        unplanned.matches.map((m) => m.id).sort(),
      )
    }
  })

  it('re-derives the whole night from source, result for result', () => {
    // Nothing structural was stored: the levels, their seeds, their frozen ranks and a
    // flat map of scores are the entire record, and replaying them gives the same
    // tournament down to the champion.
    const again = resolveLevel(levelB, nightB.results)
    expect(again.champion).toBe(nightB.view.champion)
    expect(again.matches.map((m) => m.match.id)).toEqual(
      nightB.view.matches.map((m) => m.match.id),
    )
    expect(again.stale).toHaveLength(0)
  })
})
