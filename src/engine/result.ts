import type { BestOf, GameScore, MatchResult, Side } from './types'

export interface ResultTally {
  /** null only for a double forfeit, where nobody advances. */
  winner: Side | null
  gamesA: number
  gamesB: number
  pointsA: number
  pointsB: number
  /** False for quick entry and walkovers — point ratio is not available as a tiebreak. */
  hasPoints: boolean
  /** A forfeit of any kind: the loser scores zero match points under ITTF rules. */
  walkover: boolean
}

export function gamesToWin(bestOf: BestOf): number {
  return (bestOf + 1) / 2
}

function countGames(games: readonly GameScore[]): { gamesA: number; gamesB: number; pointsA: number; pointsB: number } {
  let gamesA = 0
  let gamesB = 0
  let pointsA = 0
  let pointsB = 0
  for (const g of games) {
    pointsA += g.a
    pointsB += g.b
    if (g.a > g.b) gamesA++
    else if (g.b > g.a) gamesB++
  }
  return { gamesA, gamesB, pointsA, pointsB }
}

export function tally(result: MatchResult, bestOf: BestOf): ResultTally {
  const target = gamesToWin(bestOf)

  switch (result.kind) {
    case 'quick': {
      return {
        winner: result.a >= result.b ? 'a' : 'b',
        gamesA: result.a,
        gamesB: result.b,
        pointsA: 0,
        pointsB: 0,
        hasPoints: false,
        walkover: false,
      }
    }
    case 'detailed': {
      const c = countGames(result.games)
      return {
        winner: c.gamesA >= c.gamesB ? 'a' : 'b',
        ...c,
        hasPoints: true,
        walkover: false,
      }
    }
    case 'walkover': {
      return {
        winner: result.winner,
        gamesA: result.winner === 'a' ? target : 0,
        gamesB: result.winner === 'b' ? target : 0,
        pointsA: 0,
        pointsB: 0,
        hasPoints: false,
        walkover: true,
      }
    }
    case 'retired': {
      const c = countGames(result.games)
      // The retiring player forfeits: credit the winner a full match win, keep the
      // games actually played for the loser.
      return {
        winner: result.winner,
        gamesA: result.winner === 'a' ? Math.max(c.gamesA, target) : c.gamesA,
        gamesB: result.winner === 'b' ? Math.max(c.gamesB, target) : c.gamesB,
        pointsA: c.pointsA,
        pointsB: c.pointsB,
        hasPoints: true,
        walkover: false,
      }
    }
    case 'doubleForfeit': {
      return {
        winner: null,
        gamesA: 0,
        gamesB: 0,
        pointsA: 0,
        pointsB: 0,
        hasPoints: false,
        walkover: true,
      }
    }
  }
}

/** True once one side has reached the games needed to win the match. */
export function isComplete(result: MatchResult, bestOf: BestOf): boolean {
  if (result.kind === 'walkover' || result.kind === 'retired' || result.kind === 'doubleForfeit') {
    return true
  }
  const t = tally(result, bestOf)
  const target = gamesToWin(bestOf)
  return t.gamesA === target || t.gamesB === target
}

/**
 * Validate a single game's points against table tennis rules: first to 11, win by
 * two, with deuce continuing indefinitely. Returns null when valid.
 */
export function validateGame(game: GameScore): 'incomplete' | 'margin' | null {
  const hi = Math.max(game.a, game.b)
  const lo = Math.min(game.a, game.b)
  if (hi < 11) return 'incomplete'
  if (hi === 11) return lo <= 9 ? null : 'margin'
  // Past 11 the game must have gone to deuce, so the margin is exactly two.
  return hi - lo === 2 ? null : 'margin'
}
