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
