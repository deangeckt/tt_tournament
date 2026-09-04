/**
 * Core domain types.
 *
 * Design note: a level's authoritative state is only { playerIds, config, seed }
 * plus a flat map of match results. The draw, the bracket shape, who advanced and
 * every standings table are *derived* from those by pure functions in resolve.ts.
 * Nothing structural is ever stored, so editing a score can never leave stale
 * downstream state behind.
 */

export type PlayerId = string
export type MatchId = string
export type LevelId = string
export type GroupId = string

export type BestOf = 3 | 5 | 7

/** 'quick' records only games won (3:1); 'detailed' records every game (11-9, ...). */
export type ScoreMode = 'quick' | 'detailed'

export interface Player {
  id: PlayerId
  name: string
}

/** Points in a single game, e.g. { a: 11, b: 9 }. */
export interface GameScore {
  a: number
  b: number
}

export type Side = 'a' | 'b'

export type MatchResult =
  | { kind: 'detailed'; games: GameScore[] }
  | { kind: 'quick'; a: number; b: number }
  /** Opponent did not show up / withdrew. No games played. */
  | { kind: 'walkover'; winner: Side }
  /** Started but abandoned mid-match; games played so far are kept. */
  | { kind: 'retired'; winner: Side; games: GameScore[] }
  /** Neither player appeared. Nobody advances; the downstream slot goes vacant. */
  | { kind: 'doubleForfeit' }

/**
 * A stored result, together with who actually stood at the table.
 *
 * `playedBy` is what makes editing safe. Recomputing from source re-derives who
 * occupies each slot, but a result recorded earlier may have been played by
 * *different* people: fix a quarter-final so the other player advances, and the
 * semi-final's stored result now describes a match that never happened. Comparing
 * `playedBy` against the freshly resolved participants detects exactly that, so the
 * app can offer to void the affected results instead of silently misattributing them.
 */
export interface StoredResult {
  result: MatchResult
  playedBy: [PlayerId, PlayerId]
  enteredAt: number
}

/**
 * A match participant. Often not yet known when the fixture is generated, so
 * participants are references rather than player ids. This union is what lets a
 * single Match type serve all four formats.
 */
export type Slot =
  | { kind: 'player'; playerId: PlayerId }
  | { kind: 'bye' }
  | { kind: 'winnerOf'; matchId: MatchId }
  | { kind: 'loserOf'; matchId: MatchId }
  | { kind: 'groupRank'; groupId: GroupId; rank: number }
  | { kind: 'tbd' }

export type Stage = 'group' | 'winners' | 'losers' | 'grandFinal'

export interface Match {
  id: MatchId
  levelId: LevelId
  stage: Stage
  /** 0-based round within the stage. */
  round: number
  /** Position within the round; drives both display order and scheduling. */
  order: number
  a: Slot
  b: Slot
  /** Set on the double-elimination grand final that only happens on a bracket reset. */
  bracketReset?: boolean
  /** Group this match belongs to, for stage === 'group'. */
  groupId?: GroupId
}

export interface Group {
  id: GroupId
  levelId: LevelId
  name: string
  playerIds: PlayerId[]
}

export type FormatConfig =
  | { format: 'roundRobin' }
  | { format: 'singleElim' }
  | { format: 'doubleElim' }
  | { format: 'groupsKnockout'; groupCount: number; advancePerGroup: number }

export type FormatName = FormatConfig['format']

export interface Level {
  id: LevelId
  /** Display name, e.g. "רמה א׳". */
  name: string
  playerIds: PlayerId[]
  config: FormatConfig
  bestOf: BestOf
  /** Reproduces the draw exactly. Storing it makes the draw replayable and provable. */
  seed: string
  /** Players who withdrew after the draw; their remaining matches become walkovers. */
  withdrawn: PlayerId[]
}

export interface Tournament {
  id: string
  name: string
  /** ISO date string. */
  date: string
  scoreMode: ScoreMode
  tableCount: number
  levels: Level[]
  players: Player[]
  /** The only mutable payload the UI writes. Keyed by match id. */
  results: Record<MatchId, StoredResult>
  /** Manual table assignments, keyed by match id. */
  tableAssignments: Record<MatchId, string>
  createdAt: number
  updatedAt: number
}
