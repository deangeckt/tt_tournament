import type { BestOf, Match, MatchId, PlayerId, StoredResult } from './types'
import { tally, type ResultTally } from './result'
import { rngFromSeed, shuffle } from './rng'

/**
 * Which criterion separated a player from those they were tied with.
 *
 * `lot` and `lotPointsUnavailable` are the same outcome with different causes, and
 * the difference is the only one the user can act on: the first is a genuine dead
 * heat on every criterion the rules offer, the second fell to lots only because a
 * quick-entry result carries no per-game points, so point ratio never ran.
 */
export type TiebreakReason =
  | 'headToHead'
  | 'gameRatio'
  | 'pointRatio'
  | 'lot'
  | 'lotPointsUnavailable'

export interface StandingRow {
  playerId: PlayerId
  played: number
  won: number
  lost: number
  matchPoints: number
  gamesFor: number
  gamesAgainst: number
  pointsFor: number
  pointsAgainst: number
  rank: number
  /** Set only when this player needed a tiebreak to be separated from another. */
  tiebreakReason?: TiebreakReason
  /**
   * The dead heat this player was drawn out of, this player included — set only when
   * the tie fell to lots. It is what lets the UI name the tied players and find the
   * matches between them without re-deriving the tiers it took to get here.
   */
  tieGroup?: readonly PlayerId[]
}

export interface StandingsInput {
  playerIds: readonly PlayerId[]
  matches: readonly Match[]
  results: Readonly<Record<MatchId, StoredResult>>
  bestOf: BestOf
  /** Seeds the deterministic lot, so a drawn tie stays stable across recomputes. */
  seed: string
  /** Players whose results are struck from the table (see ITTF withdrawal rule). */
  excluded?: ReadonlySet<PlayerId>
}

interface PlayedMatch {
  a: PlayerId
  b: PlayerId
  t: ResultTally
  /**
   * A quick-entry result: it records games but no points, and — unlike a walkover,
   * which has no points to record at all — entering its game scores would supply
   * them. That is what makes a lot reached here worth reporting.
   */
  upgradable: boolean
}

/** ITTF match points: 2 for a win, 1 for a loss played out, 0 for a forfeit. */
const POINTS_WIN = 2
const POINTS_LOSS = 1
const POINTS_FORFEIT_LOSS = 0

/**
 * A ratio kept as a fraction and compared by cross-multiplication.
 *
 * Never collapsed to a float: an undefeated player has zero games lost, and
 * `won / 0` is Infinity — which compares equal to another undefeated player's
 * Infinity and silently merges two distinct records. Integer cross-multiplication
 * has no division, no Infinity and no NaN.
 */
interface Ratio {
  won: number
  lost: number
}

/** Descending: positive when x outranks y. */
function compareRatio(x: Ratio, y: Ratio): number {
  return x.won * y.lost - y.won * x.lost
}

function collectPlayed(input: StandingsInput): PlayedMatch[] {
  const excluded = input.excluded ?? new Set<PlayerId>()
  const played: PlayedMatch[] = []
  for (const match of input.matches) {
    if (match.a.kind !== 'player' || match.b.kind !== 'player') continue
    const stored = input.results[match.id]
    if (!stored) continue
    const a = match.a.playerId
    const b = match.b.playerId
    if (excluded.has(a) || excluded.has(b)) continue
    played.push({
      a,
      b,
      t: tally(stored.result, input.bestOf),
      upgradable: stored.result.kind === 'quick',
    })
  }
  return played
}

interface Agg {
  played: number
  won: number
  lost: number
  matchPoints: number
  gamesFor: number
  gamesAgainst: number
  pointsFor: number
  pointsAgainst: number
}

function emptyAgg(): Agg {
  return {
    played: 0,
    won: 0,
    lost: 0,
    matchPoints: 0,
    gamesFor: 0,
    gamesAgainst: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  }
}

function aggregate(playerIds: readonly PlayerId[], played: readonly PlayedMatch[]): Map<PlayerId, Agg> {
  const table = new Map<PlayerId, Agg>()
  for (const id of playerIds) table.set(id, emptyAgg())

  for (const { a, b, t } of played) {
    const aggA = table.get(a)
    const aggB = table.get(b)
    if (!aggA || !aggB) continue

    aggA.played++
    aggB.played++
    aggA.gamesFor += t.gamesA
    aggA.gamesAgainst += t.gamesB
    aggB.gamesFor += t.gamesB
    aggB.gamesAgainst += t.gamesA
    aggA.pointsFor += t.pointsA
    aggA.pointsAgainst += t.pointsB
    aggB.pointsFor += t.pointsB
    aggB.pointsAgainst += t.pointsA

    if (t.winner === null) {
      // Double forfeit: nobody wins, both are credited a forfeit loss.
      aggA.lost++
      aggB.lost++
      aggA.matchPoints += POINTS_FORFEIT_LOSS
      aggB.matchPoints += POINTS_FORFEIT_LOSS
      continue
    }

    const winner = t.winner === 'a' ? aggA : aggB
    const loser = t.winner === 'a' ? aggB : aggA
    winner.won++
    loser.lost++
    winner.matchPoints += POINTS_WIN
    loser.matchPoints += t.walkover ? POINTS_FORFEIT_LOSS : POINTS_LOSS
  }
  return table
}

/** Split candidates into descending tiers of players the comparator cannot separate. */
function tierBy(candidates: readonly PlayerId[], value: (id: PlayerId) => Ratio): PlayerId[][] {
  const sorted = candidates.slice().sort((x, y) => compareRatio(value(y), value(x)))

  const tiers: PlayerId[][] = []
  for (const id of sorted) {
    const last = tiers[tiers.length - 1]
    if (last && compareRatio(value(last[0]), value(id)) === 0) last.push(id)
    else tiers.push([id])
  }
  return tiers
}

interface Ranked {
  playerId: PlayerId
  reason?: TiebreakReason
  tieGroup?: readonly PlayerId[]
}

/**
 * Resolve a set of players who are level on the criterion above.
 *
 * The subtle part: each criterion is recomputed over *only* the matches between the
 * tied players, and the moment a criterion splits the group, every resulting subgroup
 * restarts the chain from the top against its own smaller candidate set. Continuing
 * down the chain instead is the classic bug — it produces standings that are wrong
 * only in three-way ties, which is exactly when people check them.
 *
 * Termination is guaranteed: recursion happens only when a tier actually splits, so
 * every subgroup is strictly smaller than the set it came from.
 */
function resolveTier(
  candidates: readonly PlayerId[],
  played: readonly PlayedMatch[],
  input: StandingsInput,
): Ranked[] {
  if (candidates.length <= 1) return candidates.map((playerId) => ({ playerId }))

  const inTier = new Set(candidates)
  const mini = played.filter((m) => inTier.has(m.a) && inTier.has(m.b))
  const table = aggregate(candidates, mini)
  const get = (id: PlayerId) => table.get(id) ?? emptyAgg()

  // Point ratio is only meaningful when every mutual match carries per-game points.
  // Mixed data would compare a player's real ratio against another's phantom 0-0.
  //
  // The tournament's entry mode is deliberately not consulted. It says how scores are
  // *typed in*, not what was recorded, and the tiebreak resolver gives one tie its
  // points without moving the whole night to detailed entry — a mode check would make
  // those scores stored and then ignored.
  const pointsUsable = mini.length > 0 && mini.every((m) => m.t.hasPoints)

  const criteria: Array<{ reason: TiebreakReason; value: (id: PlayerId) => Ratio }> = [
    // Head-to-head is not a separate rule: it is match points over mutual matches.
    { reason: 'headToHead', value: (id) => ({ won: get(id).matchPoints, lost: 1 }) },
    { reason: 'gameRatio', value: (id) => ({ won: get(id).gamesFor, lost: get(id).gamesAgainst }) },
  ]
  if (pointsUsable) {
    criteria.push({
      reason: 'pointRatio',
      value: (id) => ({ won: get(id).pointsFor, lost: get(id).pointsAgainst }),
    })
  }

  for (const criterion of criteria) {
    const tiers = tierBy(candidates, criterion.value)
    if (tiers.length > 1) {
      return tiers.flatMap((tier) =>
        resolveTier(tier, played, input).map((r) => ({
          playerId: r.playerId,
          // An inner tiebreak is the more specific explanation, so it wins.
          reason: r.reason ?? criterion.reason,
          tieGroup: r.tieGroup,
        })),
      )
    }
  }

  // Genuinely inseparable: draw lots, deterministically from the seed so the order
  // does not reshuffle every time the table is recomputed. Both the seed and the
  // shuffled input are sorted, so the drawn order depends only on *who* is tied —
  // not on the order they happen to be listed in, which would let re-ordering the
  // roster quietly change who finishes higher.
  const sorted = candidates.slice().sort()
  const lotSeed = `${input.seed}:lot:${sorted.join(',')}`
  // Separate the two ways a lot is reached. Point ratio is skipped whenever any
  // mutual match lacks points, but only a quick-entry one can still be given them, so
  // the actionable reason is reserved for a tie the user can actually break: every
  // other mutual match must already carry points. One walkover among the tied players
  // and no amount of typing will make point ratio run, so offering it would send the
  // user off to enter scores that change nothing.
  const upgradableOnly =
    mini.some((m) => m.upgradable) && mini.every((m) => m.t.hasPoints || m.upgradable)
  const reason: TiebreakReason = !pointsUsable && upgradableOnly ? 'lotPointsUnavailable' : 'lot'
  return shuffle(sorted, rngFromSeed(lotSeed)).map((playerId) => ({
    playerId,
    reason,
    tieGroup: sorted,
  }))
}

export function computeStandings(input: StandingsInput): StandingRow[] {
  const played = collectPlayed(input)
  const overall = aggregate(input.playerIds, played)
  const get = (id: PlayerId) => overall.get(id) ?? emptyAgg()

  // First pass ranks the full table; only then are ties broken among equals.
  const tiers = tierBy(input.playerIds, (id) => ({ won: get(id).matchPoints, lost: 1 }))
  const ordered = tiers.flatMap((tier) =>
    tier.length === 1 ? [{ playerId: tier[0] } as Ranked] : resolveTier(tier, played, input),
  )

  return ordered.map((entry, index) => {
    const agg = get(entry.playerId)
    return {
      playerId: entry.playerId,
      played: agg.played,
      won: agg.won,
      lost: agg.lost,
      matchPoints: agg.matchPoints,
      gamesFor: agg.gamesFor,
      gamesAgainst: agg.gamesAgainst,
      pointsFor: agg.pointsFor,
      pointsAgainst: agg.pointsAgainst,
      rank: index + 1,
      // A player who has not played cannot have been separated from anyone. Without
      // this, every row in an untouched group is annotated "decided by lot", which is
      // technically true of the ordering and completely misleading to read.
      tiebreakReason: agg.played > 0 ? entry.reason : undefined,
      tieGroup: agg.played > 0 ? entry.tieGroup : undefined,
    }
  })
}

/**
 * ITTF withdrawal rule: a player who completed fewer than half their scheduled
 * matches has their results struck from the group entirely, rather than counted as
 * losses that would distort every opponent's record.
 */
export function playersToExclude(
  matches: readonly Match[],
  results: Readonly<Record<MatchId, StoredResult>>,
  withdrawn: readonly PlayerId[],
): Set<PlayerId> {
  const excluded = new Set<PlayerId>()
  for (const id of withdrawn) {
    const scheduled = matches.filter(
      (m) =>
        (m.a.kind === 'player' && m.a.playerId === id) ||
        (m.b.kind === 'player' && m.b.playerId === id),
    )
    const completed = scheduled.filter((m) => {
      const stored = results[m.id]
      return stored && stored.result.kind !== 'walkover' && stored.result.kind !== 'doubleForfeit'
    })
    if (scheduled.length > 0 && completed.length * 2 < scheduled.length) excluded.add(id)
  }
  return excluded
}
