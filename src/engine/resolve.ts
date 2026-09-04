import type {
  Group,
  GroupId,
  Level,
  Match,
  MatchId,
  MatchResult,
  PlayerId,
  ScoreMode,
  Slot,
  StoredResult,
} from './types'
import { rngFromSeed } from './rng'
import { drawOrder, seedBracketSlots } from './draw'
import { generateGroupMatches, singleGroup } from './formats/roundRobin'
import { generateSingleElim } from './formats/singleElim'
import { buildGroupsKnockout } from './formats/groupsKnockout'
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
  played: number
  total: number
  complete: boolean
}

/**
 * Generate a level's fixture graph.
 *
 * Pure in (players, config, seed): the same three inputs always produce the same
 * matches with the same ids, which is what lets results be stored by match id and
 * everything else be recomputed rather than saved.
 */
export function buildFixtures(level: Level): { groups: Group[]; matches: Match[] } {
  const ordered = drawOrder(level.playerIds, rngFromSeed(level.seed))
  const config = level.config

  switch (config.format) {
    case 'roundRobin': {
      const group = singleGroup(level.id, level.name, ordered)
      return { groups: [group], matches: generateGroupMatches(group) }
    }
    case 'singleElim': {
      return { groups: [], matches: generateSingleElim(level.id, seedBracketSlots(ordered)) }
    }
    case 'groupsKnockout': {
      return buildGroupsKnockout(level.id, ordered, config.groupCount, config.advancePerGroup)
    }
    case 'doubleElim': {
      // Not yet implemented; the winners bracket alone keeps the app usable and the
      // fixture graph valid until formats/doubleElim.ts lands.
      return { groups: [], matches: generateSingleElim(level.id, seedBracketSlots(ordered)) }
    }
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
  scoreMode: ScoreMode,
): LevelView {
  const { groups, matches } = buildFixtures(level)
  const matchesById = new Map(matches.map((m) => [m.id, m]))
  const views = new Map<MatchId, MatchView>()
  const visiting = new Set<MatchId>()

  const groupById = new Map(groups.map((g) => [g.id, g]))
  const standings = new Map<GroupId, StandingRow[]>()

  function groupStandings(groupId: GroupId): StandingRow[] | undefined {
    if (standings.has(groupId)) return standings.get(groupId)
    const group = groupById.get(groupId)
    if (!group) return undefined

    const groupMatches = matches.filter((m) => m.groupId === groupId)
    // Only results that still belong to the players standing there may count.
    const usable: Record<MatchId, StoredResult> = {}
    for (const m of groupMatches) {
      const stored = results[m.id]
      if (!stored) continue
      if (m.a.kind !== 'player' || m.b.kind !== 'player') continue
      if (classifyStaleness(stored, m.a, m.b) !== 'fresh') continue
      usable[m.id] = stored
    }

    const rows = computeStandings({
      playerIds: group.playerIds,
      matches: groupMatches,
      results: usable,
      bestOf: level.bestOf,
      scoreMode,
      seed: level.seed,
      excluded: playersToExclude(groupMatches, usable, level.withdrawn),
    })
    standings.set(groupId, rows)
    return rows
  }

  function groupComplete(groupId: GroupId): boolean {
    const groupMatches = matches.filter((m) => m.groupId === groupId)
    if (groupMatches.length === 0) return false
    return groupMatches.every((m) => {
      const stored = results[m.id]
      return stored && m.a.kind === 'player' && m.b.kind === 'player'
        ? classifyStaleness(stored, m.a, m.b) === 'fresh'
        : false
    })
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

  const finals = all.filter((v) => v.match.stage !== 'group')
  const lastRound = finals.length > 0 ? Math.max(...finals.map((v) => v.match.round)) : -1
  const finalView = finals.find((v) => v.match.round === lastRound && v.match.order === 0)

  let champion = finalView?.winner
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
    played,
    total: needsPlaying.length,
    complete,
  }
}
