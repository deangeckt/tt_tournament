import type { BestOf, FormatConfig, FormatName } from './types'

export interface FormatShape {
  config: FormatConfig
  /** Matches that will actually be played. */
  matchCount: number
  /** The fewest matches any entrant is guaranteed — the fairness signal. */
  minMatchesPerPlayer: number
  /**
   * Rough wall-clock length, not total table time. Dividing by the number of tables
   * is what makes the number decision-useful: 28 matches is a ten-hour evening on one
   * table and a two-and-a-half-hour one on four.
   */
  estimatedMinutes: number
}

/** Minutes a single match occupies a table, by length. */
const MINUTES: Record<BestOf, number> = { 3: 15, 5: 22, 7: 30 }

export function minimumPlayers(format: FormatName): number {
  switch (format) {
    case 'roundRobin':
      return 3
    case 'singleElim':
    case 'doubleElim':
      return 4
    case 'groupsKnockout':
      return 6
  }
}

function roundRobinMatches(n: number): number {
  return (n * (n - 1)) / 2
}

/** Sizes of `count` groups formed from `n` players, largest first. */
export function groupSizes(n: number, count: number): number[] {
  const base = Math.floor(n / count)
  const remainder = n % count
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0))
}

/**
 * How many players the main draw eliminates, and so how big the consolation is.
 *
 * A knockout sends down everyone but the two finalists. A group stage sends down
 * everyone it does not qualify — and it is the group stage alone that does the
 * eliminating there, because the players it puts through are still in the main
 * competition when the consolation is drawn.
 */
export function consolationFieldSize(config: FormatConfig, playerCount: number): number {
  switch (config.format) {
    case 'singleElim':
      return Math.max(0, playerCount - 2)
    case 'groupsKnockout':
      return Math.max(0, playerCount - config.groupCount * config.advancePerGroup)
    default:
      return 0
  }
}

/**
 * The format a consolation runs, scaled to the losers' field.
 *
 * The same format as the main wherever the field can take it. A groups-then-knockout
 * night whose losers are too few for a group stage still gets a consolation — as a
 * straight knockout, which is the elimination-shaped thing and reuses the bracket
 * generator whole. Below two players there is nothing to play.
 *
 * Lives here rather than beside the generator because it is the same question
 * `suggestedConfig` answers — what shape should this competition be — and because the
 * duration advice below has to ask it too.
 */
export function consolationConfig(main: FormatConfig, fieldSize: number): FormatConfig | null {
  if (fieldSize < 2) return null

  if (main.format === 'groupsKnockout') {
    const sameAgain: FormatConfig = {
      format: 'groupsKnockout',
      groupCount: suggestGroupCount(fieldSize),
      advancePerGroup: main.advancePerGroup,
    }
    if (!validateConfig(sameAgain, fieldSize)) return sameAgain
  }

  return { format: 'singleElim' }
}

export function describe(
  config: FormatConfig,
  playerCount: number,
  bestOf: BestOf,
  tableCount = 1,
): FormatShape {
  const perMatch = MINUTES[bestOf]
  let matchCount = 0
  let minMatchesPerPlayer = 0

  switch (config.format) {
    case 'roundRobin': {
      matchCount = roundRobinMatches(playerCount)
      minMatchesPerPlayer = Math.max(0, playerCount - 1)
      break
    }
    case 'singleElim': {
      matchCount = Math.max(0, playerCount - 1)
      minMatchesPerPlayer = playerCount > 1 ? 1 : 0
      break
    }
    case 'doubleElim': {
      matchCount = Math.max(0, playerCount * 2 - 2)
      minMatchesPerPlayer = playerCount > 1 ? 2 : 0
      break
    }
    case 'groupsKnockout': {
      const sizes = groupSizes(playerCount, config.groupCount)
      const groupMatches = sizes.reduce((sum, size) => sum + roundRobinMatches(size), 0)
      const qualifiers = config.groupCount * config.advancePerGroup
      // A padded bracket plays one match per eliminated player.
      const bracketMatches = Math.max(0, qualifiers - 1)
      matchCount = groupMatches + bracketMatches
      minMatchesPerPlayer = Math.max(0, Math.min(...sizes) - 1)
      break
    }
  }

  // A consolation is a whole second competition and can half again the length of the
  // night, so it has to be in the number the format card shows — that card is the only
  // place anyone is told what they are committing the evening to.
  if (config.format === 'singleElim' || config.format === 'groupsKnockout') {
    if (config.consolation) {
      const field = consolationFieldSize(config, playerCount)
      const shape = consolationConfig(config, field)
      if (shape) {
        const consolation = describe(shape, field, bestOf)
        matchCount += consolation.matchCount
        // The floor is what a player who goes out early gets, which is the whole point
        // of running one: their main-draw minimum, and then the consolation's.
        minMatchesPerPlayer += consolation.minMatchesPerPlayer
      }
    }
  }

  // A knockout round cannot start before the previous one finishes, so tables never
  // fully parallelise. Rounding up keeps the estimate honest rather than optimistic.
  const tables = Math.max(1, tableCount)
  return {
    config,
    matchCount,
    minMatchesPerPlayer,
    estimatedMinutes: Math.ceil((matchCount * perMatch) / tables),
  }
}

/** Group count that gets closest to groups of four, the club sweet spot. */
export function suggestGroupCount(playerCount: number): number {
  if (playerCount < 6) return 1
  const byFour = Math.round(playerCount / 4)
  return Math.max(2, Math.min(byFour, Math.floor(playerCount / 3)))
}

export function suggestedConfig(playerCount: number): FormatConfig {
  if (playerCount < 4) return { format: 'roundRobin' }
  if (playerCount <= 6) return { format: 'roundRobin' }
  return {
    format: 'groupsKnockout',
    groupCount: suggestGroupCount(playerCount),
    advancePerGroup: 2,
  }
}

export interface ConfigProblem {
  code: 'tooFew' | 'groupTooSmall'
  needed: number
}

/**
 * Blocking problems with a chosen configuration, checked before the draw.
 *
 * Bye counts deliberately are not validated: padding to the next power of two can
 * never produce more byes than players, so a bracket is always at least half real.
 */
export function validateConfig(config: FormatConfig, playerCount: number): ConfigProblem | null {
  const min = minimumPlayers(config.format)
  if (playerCount < min) return { code: 'tooFew', needed: min }

  if (config.format === 'groupsKnockout') {
    const sizes = groupSizes(playerCount, config.groupCount)
    // Every group must be able to supply its qualifiers and still play matches.
    if (Math.min(...sizes) < config.advancePerGroup + 1) {
      return { code: 'groupTooSmall', needed: config.groupCount * (config.advancePerGroup + 1) }
    }
  }
  return null
}
