import type { TFunction } from 'i18next'

/**
 * "3 tournaments · 24 players" — how much of a club's history is in front of you.
 *
 * Two keys rather than one sentence because Hebrew has a dual form and i18next can
 * pluralise only one count per key, so "1 tournaments · 2 player" is what a single
 * interpolated string would eventually produce.
 *
 * Shared because it is said in two places that must agree: under the settings title,
 * and in the toast confirming an import — which now surfaces wherever the reload
 * happens to land, not only on the screen that started it.
 */
export function dataCounts(t: TFunction, tournaments: number, players: number): string {
  return `${t('settings.tournamentCount', { count: tournaments })} · ${t('home.players', {
    count: players,
  })}`
}

/**
 * "12 updated · 3 not found" — what a rank refresh came to, leaving out what it did
 * not do.
 *
 * Shared for the same reason as `dataCounts`: the settings card and the toast that
 * ends a run say it, and the toast may land on another screen entirely.
 */
export function refreshCounts(
  t: TFunction,
  outcomes: readonly { kind: 'updated' | 'unchanged' | 'notFound' | 'skipped' }[],
): string {
  return (['updated', 'unchanged', 'notFound', 'skipped'] as const)
    .map((kind) => ({ kind, count: outcomes.filter((o) => o.kind === kind).length }))
    .filter(({ count }) => count > 0)
    .map(({ kind, count }) => t(`refresh.${kind}`, { count }))
    .join(' · ')
}
