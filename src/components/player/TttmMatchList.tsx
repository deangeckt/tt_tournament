import { useTranslation } from 'react-i18next'
import { photoThumbUrl } from '../../tttm/lookup'
import type { TttmPlayer } from '../../tttm/parse'
import { Ltr } from '../common/ui'

/**
 * TTTM players to choose between, one tap each.
 *
 * Shared by the card's own lookup and the question a rank refresh stops to ask,
 * because both are the same decision — which of these people is ours — and the
 * club, category and points under each name are what make it. Two lists would
 * sooner or later disagree about which of those they show.
 */
export function TttmMatchList({
  matches,
  disabled = false,
  onPick,
}: {
  matches: readonly TttmPlayer[]
  disabled?: boolean
  onPick: (match: TttmPlayer) => void
}) {
  const { t } = useTranslation()
  return (
    <ul className="divide-y divide-court-200/70 overflow-hidden rounded-xl bg-white dark:divide-court-700/70 dark:bg-court-900">
      {matches.map((match) => (
        <li key={match.tttmId}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(match)}
            className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-start
              transition hover:bg-court-50 disabled:opacity-50 dark:hover:bg-court-800"
          >
            {match.photo ? (
              // Decorative: the name is right next to it. Routed through the same
              // image relay the saved photograph goes through, so browsing the list
              // tells TTTM nothing. The ground is the no-photo disc's, so a thumbnail
              // that cannot load — offline, or the relay down — looks like no photo
              // rather than a broken image.
              <img
                src={photoThumbUrl(match.photo, 96)}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full bg-court-100 object-cover dark:bg-court-800"
              />
            ) : (
              <span
                aria-hidden="true"
                className="h-9 w-9 shrink-0 rounded-full bg-court-100 dark:bg-court-800"
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{match.name}</span>
              <span className="block truncate text-sm text-court-500 dark:text-court-300">
                {match.club ?? t('rank.noClub')}
                {match.category ? ` · ${match.category}` : ''}
                {match.position !== undefined
                  ? ` · ${t('rank.position', { n: match.position })}`
                  : ''}
              </span>
            </span>
            <span className="shrink-0 font-bold tabular-nums">
              <Ltr>{match.rank}</Ltr>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
