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
  /**
   * A small, already-downscaled data URL. Kept on the roster record only — a
   * tournament stores slim {id,name} copies, so a share payload never carries
   * photos and stays inside a URL.
   */
  photo?: string
  /**
   * The player's TTTM ranking points, e.g. 1747.6. Higher is stronger.
   *
   * Deliberately the raw points rather than a ladder position: a position shuffles
   * every time anyone else plays, while the gap between 1747 and 900 is the thing the
   * draw actually wants to know. Absent means unranked, which is not the same as
   * zero — a player on 0.0 has a ranking and has not scored on it yet.
   */
  rank?: number
  /** Their id on tttm.co.il, kept so a rank can be refreshed without searching again. */
  tttmId?: number
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
  /** Display name, e.g. "דרג א׳". */
  name: string
  playerIds: PlayerId[]
  config: FormatConfig
  bestOf: BestOf
  /** Reproduces the draw exactly. Storing it makes the draw replayable and provable. */
  seed: string
  /**
   * A manager's hand-made draw order, overriding the seeded shuffle.
   *
   * Still just *source* state: it replaces the one input the fixtures derive from,
   * so groups, bracket and standings recompute exactly as before. Ids not in the
   * level any more are ignored and late entrants fall in at their seeded position,
   * so this survives roster edits without needing a redraw.
   */
  manualOrder?: PlayerId[]
  /** Players who withdrew after the draw; their remaining matches become walkovers. */
  withdrawn: PlayerId[]
  /**
   * The ranking points this level was drawn against, frozen when the draw was made.
   *
   * The one piece of source state that is copied rather than read live, because its
   * origin is *outside* the tournament: a rank is a roster field that TTTM revises
   * every week. Deriving the draw from the live value would mean correcting a rank in
   * March silently rearranging January's bracket and throwing every result in it onto
   * the stale pile. So a level keeps the numbers it was drawn against, and drawing
   * again is what picks up new ones.
   *
   * Absent — every tournament drawn before ranks existed — means an unweighted
   * shuffle, exactly as before.
   */
  ranks?: Record<PlayerId, number>
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
