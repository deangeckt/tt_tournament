import type {
  Group,
  GroupId,
  Level,
  Match,
  MatchId,
  MatchResult,
  PlayerId,
  Slot,
  StoredResult,
} from './types'
import { rngFromSeed } from './rng'
import {
  bandedBracketOrder,
  bandedGroupOrder,
  drawOrder,
  rankedOrder,
  seedBracketSlots,
} from './draw'
import { seedByRank } from './schedule'
import { generateGroupMatches, singleGroup } from './formats/roundRobin'
import { generateSingleElim } from './formats/singleElim'
import { buildGroupsKnockout } from './formats/groupsKnockout'
import {
  consolationLevel,
  generateConsolationBracket,
  hasConsolation,
  tagConsolation,
} from './formats/consolation'
import { tally } from './result'
import { computeStandings, playersToExclude, type StandingRow } from './standings'

/** A match participant once the fixture graph has been walked. */
export type Participant =
  | { kind: 'player'; playerId: PlayerId }
  | { kind: 'bye' }
  /** Upstream produced nobody — a double forfeit, or a bye that yielded no loser. */
  | { kind: 'vacant' }
  /** Not yet determined; the UI renders "winner of ..." from `from`. */
  | { kind: 'tbd'; from: Slot }

/**
 * How a stored result relates to the players currently occupying the match.
 *
 * `swapped` is worth distinguishing from `mismatched`: it is the common case after a
 * group correction reorders qualifiers, and the fix is to flip the score rather than
 * discard it.
 */
export type Staleness = 'fresh' | 'swapped' | 'mismatched'

export interface MatchView {
  match: Match
  a: Participant
  b: Participant
  result?: MatchResult
  /** Both sides are real players, so a score can be entered. */
  playable: boolean
  /** Decided without being played, because the opponent was a bye. */
  auto: boolean
  staleness: Staleness
  winner?: PlayerId
  loser?: PlayerId
  /** Nobody advances from here. */
  vacant: boolean
}

export interface LevelView {
  level: Level
  groups: Group[]
  matches: MatchView[]
  byId: Map<MatchId, MatchView>
  standings: Map<GroupId, StandingRow[]>
  /** Matches whose stored result no longer matches who stands there. */
  stale: MatchView[]
  champion?: PlayerId
  /** Winner of the consolation, which is a separate competition with its own title. */
  consolationChampion?: PlayerId
  /** A consolation is switched on but its field is not settled yet. */
  consolationPending: boolean
  played: number
  total: number
  complete: boolean
}

/**
 * The seeded draw, before any hand-made arrangement is laid over it.
 *
 * With no ranks this is a flat shuffle, which is what every draw made before ranks
 * existed still gets. With them it is a *banded* draw: the field is sorted by ranking
 * points and then arranged so that the generator's own permutation — the snake for
 * groups, the seed order for a bracket — lands near neighbours together rather than
 * spreading them apart. The result is a night of matches between players of roughly
 * one standard, which is the point of collecting the ranks at all.
 *
 * The seed still decides everything rank does not: who among the unranked goes where,
 * and how players level on points are ordered. A field where everyone carries a
 * different rank is drawn the same way every time, and drawing it again will say so.
 */
function drawnOrder(level: Level): PlayerId[] {
  const rng = rngFromSeed(level.seed)
  const ranks = level.ranks
  if (!ranks || !level.playerIds.some((id) => ranks[id] !== undefined)) {
    return drawOrder(level.playerIds, rng)
  }

  const sorted = rankedOrder(level.playerIds, ranks, rng)
  switch (level.config.format) {
    case 'roundRobin':
      // Everyone meets everyone, so there is no banding to do — the draw order only
      // decides how the field is listed, and strongest first reads like the standings
      // will. What order the matches are *played* in is planned separately, from the
      // same ranks, in `schedule.ts`.
      return sorted
    case 'groupsKnockout':
      return bandedGroupOrder(sorted, level.config.groupCount)
    case 'singleElim':
    case 'doubleElim':
      return bandedBracketOrder(sorted)
  }
}

/**
 * The draw order every fixture derives from: the seeded shuffle, unless the manager
 * has arranged one by hand.
 *
 * A manual order is reconciled against the level's current players rather than
 * trusted outright: ids that have since been removed drop out, and anyone added
 * afterwards is appended in their seeded position. That keeps a hand-made draw valid
 * across roster edits instead of forcing a redraw whenever a latecomer arrives.
 */
export function levelDrawOrder(level: Level): PlayerId[] {
  const seeded = drawnOrder(level)
  if (!level.manualOrder || level.manualOrder.length === 0) return seeded

  const inLevel = new Set(level.playerIds)
  const kept = level.manualOrder.filter((id) => inLevel.has(id))
  const placed = new Set(kept)
  return [...kept, ...seeded.filter((id) => !placed.has(id))]
}

/** Where each player in the draw order lands, for the manual draw editor. */
export interface DrawPlacement {
  playerId: PlayerId
  position: number
  /** Set for formats with a group stage. */
  groupId?: GroupId
  /** First-round bracket match, for the knockout-only formats. */
  matchId?: MatchId
}

export function drawPlacements(level: Level): DrawPlacement[] {
  // The main draw only: the consolation is a second draw made later, from whoever this
  // one eliminates, and has no place on the screen that arranges this one.
  const { groups, matches } = mainFixtures(level)
  const groupOf = new Map<PlayerId, GroupId>()
  for (const group of groups) for (const id of group.playerIds) groupOf.set(id, group.id)

  const matchOf = new Map<PlayerId, MatchId>()
  for (const match of matches) {
    if (match.stage === 'group' || match.consolation || match.round !== 0) continue
    for (const slot of [match.a, match.b]) {
      if (slot.kind === 'player') matchOf.set(slot.playerId, match.id)
    }
  }

  return levelDrawOrder(level).map((playerId, position) => ({
    playerId,
    position,
    groupId: groupOf.get(playerId),
    matchId: matchOf.get(playerId),
  }))
}

/**
 * Generate a level's main fixture graph — the competition everybody starts in.
 *
 * Pure in the level's own source state — players, config, seed and the ranks it was
 * drawn against — so the same level always produces the same matches with the same
 * ids, which is what lets results be stored by match id and everything else be
 * recomputed rather than saved.
 */
function mainFixtures(level: Level): { groups: Group[]; matches: Match[] } {
  const ordered = levelDrawOrder(level)
  const config = level.config

  switch (config.format) {
    case 'roundRobin': {
      const group = singleGroup(level.id, level.name, ordered)
      // One group, and its winner is the level's champion, so one player "advances"
      // — which is what puts the top two seeds in the closing match of the night.
      const matches = generateGroupMatches(group, {
        seeded: seedByRank(group.playerIds, level.ranks),
        advance: 1,
      })
      return { groups: [group], matches }
    }
    case 'singleElim': {
      return { groups: [], matches: generateSingleElim(level.id, seedBracketSlots(ordered)) }
    }
    case 'groupsKnockout': {
      return buildGroupsKnockout(
        level.id,
        ordered,
        config.groupCount,
        config.advancePerGroup,
        level.ranks,
      )
    }
    case 'doubleElim': {
      // Not yet implemented; the winners bracket alone keeps the app usable and the
      // fixture graph valid until formats/doubleElim.ts lands.
      return { groups: [], matches: generateSingleElim(level.id, seedBracketSlots(ordered)) }
    }
  }
}

/** The results of a group's matches that may still count: both sides real, and fresh. */
function usableGroupResults(
  groupMatches: readonly Match[],
  results: Readonly<Record<MatchId, StoredResult>>,
): Record<MatchId, StoredResult> {
  const usable: Record<MatchId, StoredResult> = {}
  for (const match of groupMatches) {
    const stored = results[match.id]
    if (!stored) continue
    if (match.a.kind !== 'player' || match.b.kind !== 'player') continue
    if (classifyStaleness(stored, match.a, match.b) !== 'fresh') continue
    usable[match.id] = stored
  }
  return usable
}

/**
 * One group's table.
 *
 * Module level rather than a closure inside `resolveLevel` because the consolation
 * field is read from the very same tables the main bracket's qualifiers come from, and
 * two implementations of "who came third" would eventually disagree about who goes up
 * and who goes down.
 */
function groupTable(
  group: Group,
  groupMatches: readonly Match[],
  results: Readonly<Record<MatchId, StoredResult>>,
  level: Level,
): StandingRow[] {
  const usable = usableGroupResults(groupMatches, results)
  return computeStandings({
    playerIds: group.playerIds,
    matches: groupMatches,
    results: usable,
    bestOf: level.bestOf,
    seed: level.seed,
    excluded: playersToExclude(groupMatches, usable, level.withdrawn),
  })
}

function groupFinished(
  groupMatches: readonly Match[],
  results: Readonly<Record<MatchId, StoredResult>>,
): boolean {
  if (groupMatches.length === 0) return false
  return groupMatches.every((match) => {
    const stored = results[match.id]
    return stored && match.a.kind === 'player' && match.b.kind === 'player'
      ? classifyStaleness(stored, match.a, match.b) === 'fresh'
      : false
  })
}

/**
 * Everyone the group stage has knocked out, or null while it is still being played.
 *
 * All or nothing on purpose: a consolation drawn from half-finished groups would be
 * re-drawn on every result that followed, and every match played in it detached from
 * its own scoreline.
 */
function eliminatedByGroups(
  level: Level,
  main: { groups: Group[]; matches: Match[] },
  results: Readonly<Record<MatchId, StoredResult>>,
  advancePerGroup: number,
): PlayerId[] | null {
  const field: PlayerId[] = []
  for (const group of main.groups) {
    const groupMatches = main.matches.filter((match) => match.groupId === group.id)
    if (!groupFinished(groupMatches, results)) return null
    for (const row of groupTable(group, groupMatches, results, level).slice(advancePerGroup)) {
      field.push(row.playerId)
    }
  }
  return field
}

/**
 * A level's whole fixture graph: the main draw, and the consolation if it is on.
 *
 * Still a pure function of stored source state — `results` is source state, the one
 * mutable payload the UI writes. What the second argument buys is a consolation whose
 * *field* can be read off the main draw: a groups-then-knockout consolation is drawn
 * from the players the group stage eliminated, and those are not known until it has
 * been played. A single-elimination consolation needs none of this — it is fed by
 * `loserOf` references and exists from the moment of the draw — so passing nothing
 * still yields a complete graph for every format that does not have a group stage.
 */
export function buildFixtures(
  level: Level,
  results: Readonly<Record<MatchId, StoredResult>> = {},
): { groups: Group[]; matches: Match[] } {
  const main = mainFixtures(level)
  const config = level.config
  if (!hasConsolation(config)) return main

  if (config.format === 'singleElim') {
    return {
      groups: main.groups,
      matches: [...main.matches, ...generateConsolationBracket(level.id, main.matches)],
    }
  }

  if (config.format !== 'groupsKnockout') return main
  const field = eliminatedByGroups(level, main, results, config.advancePerGroup)
  if (!field) return main

  const drawnAs = consolationLevel(level, field)
  if (!drawnAs) return main

  // The consolation goes down the same pipeline the main draw did — banded draw,
  // running order, bye padding and all — under an id of its own so nothing collides.
  const consolation = tagConsolation(level.id, buildFixtures(drawnAs))
  return {
    groups: [...main.groups, ...consolation.groups],
    matches: [...main.matches, ...consolation.matches],
  }
}

function participantId(p: Participant): PlayerId | undefined {
  return p.kind === 'player' ? p.playerId : undefined
}

function classifyStaleness(stored: StoredResult, a: Participant, b: Participant): Staleness {
  const [pa, pb] = stored.playedBy
  const ca = participantId(a)
  const cb = participantId(b)
  if (ca === pa && cb === pb) return 'fresh'
  if (ca === pb && cb === pa) return 'swapped'
  return 'mismatched'
}

/**
 * Walk the fixture graph and fill in every participant, winner and standings table.
 *
 * Memoized depth-first with a visiting set: a cycle would mean a fixture generator
 * produced a match that depends on itself, which is a bug rather than a user error,
 * so it is contained here (treated as undetermined) instead of hanging the UI.
 */
export function resolveLevel(
  level: Level,
  results: Readonly<Record<MatchId, StoredResult>>,
): LevelView {
  const { groups, matches } = buildFixtures(level, results)
  const matchesById = new Map(matches.map((m) => [m.id, m]))
  const views = new Map<MatchId, MatchView>()
  const visiting = new Set<MatchId>()

  const groupById = new Map(groups.map((g) => [g.id, g]))
  const standings = new Map<GroupId, StandingRow[]>()

  function groupStandings(groupId: GroupId): StandingRow[] | undefined {
    if (standings.has(groupId)) return standings.get(groupId)
    const group = groupById.get(groupId)
    if (!group) return undefined

    const rows = groupTable(
      group,
      matches.filter((m) => m.groupId === groupId),
      results,
      level,
    )
    standings.set(groupId, rows)
    return rows
  }

  function groupComplete(groupId: GroupId): boolean {
    return groupFinished(
      matches.filter((m) => m.groupId === groupId),
      results,
    )
  }

  function resolveSlot(slot: Slot): Participant {
    switch (slot.kind) {
      case 'player':
        return { kind: 'player', playerId: slot.playerId }
      case 'bye':
        return { kind: 'bye' }
      case 'tbd':
        return { kind: 'tbd', from: slot }
      case 'winnerOf': {
        const view = resolveMatch(slot.matchId)
        if (!view) return { kind: 'tbd', from: slot }
        if (view.vacant) return { kind: 'vacant' }
        return view.winner ? { kind: 'player', playerId: view.winner } : { kind: 'tbd', from: slot }
      }
      case 'loserOf': {
        const view = resolveMatch(slot.matchId)
        if (!view) return { kind: 'tbd', from: slot }
        // A match won on a bye produces no loser at all.
        if (view.auto || view.vacant) return { kind: 'vacant' }
        return view.loser ? { kind: 'player', playerId: view.loser } : { kind: 'tbd', from: slot }
      }
      case 'groupRank': {
        if (!groupComplete(slot.groupId)) return { kind: 'tbd', from: slot }
        const rows = groupStandings(slot.groupId)
        const row = rows?.[slot.rank - 1]
        return row ? { kind: 'player', playerId: row.playerId } : { kind: 'vacant' }
      }
    }
  }

  function resolveMatch(id: MatchId): MatchView | undefined {
    const cached = views.get(id)
    if (cached) return cached
    const match = matchesById.get(id)
    if (!match) return undefined
    if (visiting.has(id)) return undefined // cycle: treat as undetermined
    visiting.add(id)

    const a = resolveSlot(match.a)
    const b = resolveSlot(match.b)
    const aId = participantId(a)
    const bId = participantId(b)

    const stored = results[id]
    const staleness = stored ? classifyStaleness(stored, a, b) : 'fresh'
    const usableResult = stored && staleness === 'fresh' ? stored.result : undefined

    let winner: PlayerId | undefined
    let loser: PlayerId | undefined
    let auto = false
    let vacant = false

    const aPresent = a.kind === 'player'
    const bPresent = b.kind === 'player'
    // A bye or a vacancy means nobody is ever coming; 'tbd' means someone still is,
    // so a player waiting on an undecided match must not be advanced.
    const aEmpty = a.kind === 'bye' || a.kind === 'vacant'
    const bEmpty = b.kind === 'bye' || b.kind === 'vacant'

    if (aPresent && bEmpty) {
      // Walks over an empty slot; no result is stored or needed.
      winner = aId
      auto = true
    } else if (bPresent && aEmpty) {
      winner = bId
      auto = true
    } else if (aEmpty && bEmpty) {
      vacant = true
    } else if (aPresent && bPresent && usableResult) {
      const t = tally(usableResult, level.bestOf)
      if (t.winner === null) {
        vacant = true
      } else {
        winner = t.winner === 'a' ? aId : bId
        loser = t.winner === 'a' ? bId : aId
      }
    }

    const view: MatchView = {
      match,
      a,
      b,
      result: usableResult,
      playable: aPresent && bPresent,
      auto,
      staleness: stored ? staleness : 'fresh',
      winner,
      loser,
      vacant,
    }
    visiting.delete(id)
    views.set(id, view)
    return view
  }

  for (const m of matches) resolveMatch(m.id)
  for (const g of groups) groupStandings(g.id)

  const all = matches.map((m) => views.get(m.id)!).filter(Boolean)
  // The progress denominator is every match that will actually need to be played:
  // byes and vacancies resolve themselves, everything else waits on a referee.
  const needsPlaying = all.filter((v) => !v.auto && !v.vacant)
  const played = all.filter((v) => v.result).length

  /** The winner of a bracket's last match — its own title, whichever bracket it is. */
  const bracketWinner = (bracket: MatchView[]): PlayerId | undefined => {
    if (bracket.length === 0) return undefined
    const lastRound = Math.max(...bracket.map((v) => v.match.round))
    return bracket.find((v) => v.match.round === lastRound && v.match.order === 0)?.winner
  }

  // Scoped to the main draw on purpose. The consolation is a second competition with a
  // title of its own, and a consolation bracket can easily run deeper than the main one
  // — read across both, a level would crown the plate winner, and `stats.ts` would post
  // that straight into a career record.
  const finals = all.filter((v) => !v.match.consolation && v.match.stage !== 'group')

  let champion = bracketWinner(finals)
  let complete = played === needsPlaying.length && needsPlaying.length > 0
  if (finals.length === 0) {
    // Pure round robin: the champion is whoever tops the single group's table.
    const rows = groups[0] ? standings.get(groups[0].id) : undefined
    if (complete) champion = rows?.[0]?.playerId
  } else {
    complete = complete && Boolean(champion)
  }

  return {
    level,
    groups,
    matches: all,
    byId: views,
    standings,
    stale: all.filter((v) => v.staleness !== 'fresh'),
    champion,
    consolationChampion: bracketWinner(
      all.filter((v) => v.match.consolation && v.match.stage !== 'group'),
    ),
    // On, but the group stage that decides who plays in it is still being played.
    consolationPending: hasConsolation(level.config) && !all.some((v) => v.match.consolation),
    played,
    total: needsPlaying.length,
    complete,
  }
}
