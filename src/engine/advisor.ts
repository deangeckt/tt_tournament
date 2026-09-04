import type { BestOf, FormatConfig, FormatName } from './types'

export interface FormatShape {
  config: FormatConfig
  /** Matches that will actually be played. */
  matchCount: number
  /** The fewest matches any entrant is guaranteed — the fairness signal. */
  minMatchesPerPlayer: number
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

export function describe(config: FormatConfig, playerCount: number, bestOf: BestOf): FormatShape {
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

  return {
    config,
    matchCount,
    minMatchesPerPlayer,
    estimatedMinutes: matchCount * perMatch,
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
