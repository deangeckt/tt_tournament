import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Player } from '../../engine/types'
import { useAppStore } from '../../store/useAppStore'
import { fetchTttmPhoto, fetchTttmPlayer, photoThumbUrl, searchTttm } from '../../tttm/lookup'
import { playerPageUrl, type TttmPlayer } from '../../tttm/parse'
import { Button, Ltr, inputClass } from '../common/ui'
import { toast } from '../../store/useToasts'

/**
 * A player's ranking points, and the three ways of arriving at them.
 *
 * The number is what the draw wants — it bands the field so people meet others of
 * their own standard — and the reason there are three ways in is that the league's
 * own database is only reliably reachable by one of them at a time. Typing it is
 * always possible. Searching works once the season's ranking list is out. A pasted
 * link is what is left in the weeks before that, when the player exists, the page
 * exists, and the search returns nothing at all.
 *
 * The lookup is folded away by default. Most visits here are to check a record or fix
 * a spelling, and a manager who already knows the number should see a box to type it
 * in, not a search engine.
 */
export function RankSection({ player }: { player: Player }) {
  const { t } = useTranslation()
  const patchRosterPlayer = useAppStore((s) => s.patchRosterPlayer)

  const [draft, setDraft] = useState(player.rank === undefined ? '' : String(player.rank))
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState(player.name)
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState<'search' | 'link' | 'apply' | null>(null)
  const [found, setFound] = useState<TttmPlayer[] | null>(null)
  /** An i18n key for whatever the last lookup had to say, when it was not a result. */
  const [problem, setProblem] = useState<string | null>(null)

  const commit = async () => {
    const trimmed = draft.trim()
    if (trimmed === '') {
      if (player.rank === undefined) return
      await patchRosterPlayer(player.id, { rank: undefined })
      toast(t('rank.cleared', { name: player.name }), 'warn')
      return
    }

    const value = Number(trimmed)
    if (!Number.isFinite(value) || value < 0) {
      toast(t('rank.invalid'), 'warn')
      setDraft(player.rank === undefined ? '' : String(player.rank))
      return
    }
    if (value === player.rank) return
    await patchRosterPlayer(player.id, { rank: value })
    toast(t('rank.saved', { name: player.name }))
  }

  /** Take a found player's number — and their picture, if this one has none yet. */
  const apply = async (match: TttmPlayer) => {
    setBusy('apply')
    try {
      await patchRosterPlayer(player.id, { rank: match.rank, tttmId: match.tttmId })
      setDraft(String(match.rank))

      // Never over an existing photograph: the club's own picture of somebody is the
      // one the manager chose, and a league mugshot is not an upgrade on it.
      const photo = match.photo && !player.photo ? await fetchTttmPhoto(match.photo) : undefined
      if (photo) await patchRosterPlayer(player.id, { photo })

      toast(
        t(photo ? 'rank.appliedPhoto' : 'rank.applied', {
          name: player.name,
          rank: match.rank,
        }),
      )
      setFound(null)
      setOpen(false)
    } finally {
      setBusy(null)
    }
  }

  const runSearch = async () => {
    const wanted = term.trim()
    if (!wanted) return
    setBusy('search')
    setProblem(null)
    setFound(null)
    try {
      const outcome = await searchTttm(wanted)
      if (outcome.kind === 'ok') setFound(outcome.value)
      else setProblem(`rank.${outcome.kind}`)
    } finally {
      setBusy(null)
    }
  }

  const runLink = async () => {
    const pasted = link.trim()
    if (!pasted) return
    setBusy('link')
    setProblem(null)
    setFound(null)
    try {
      const outcome = await fetchTttmPlayer(pasted)
      if (outcome.kind === 'ok') await apply(outcome.value)
      else setProblem(outcome.kind === 'none' ? 'rank.badLink' : `rank.${outcome.kind}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-xl bg-court-100/70 p-4 dark:bg-court-800/60">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
        <h3 className="font-bold">{t('rank.title')}</h3>
        {player.tttmId !== undefined ? (
          <a
            href={playerPageUrl(player.tttmId, player.name)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-court-600 underline underline-offset-2 hover:text-court-800 dark:text-court-200 dark:hover:text-white"
          >
            {t('rank.open')} ↗
          </a>
        ) : null}
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          // Digits are latin whichever way the page runs, and a rank typed into an
          // RTL field would have its decimal point pushed to the wrong end.
          dir="ltr"
          inputMode="decimal"
          placeholder={t('rank.placeholder')}
          aria-label={t('rank.title')}
          className={`${inputClass} num`}
        />
        <Button variant="subtle" onClick={() => void commit()}>
          {t('common.save')}
        </Button>
      </div>
      <p className="mt-1.5 text-sm text-court-600 dark:text-court-200">{t('rank.hint')}</p>

      <div className="mt-3 border-t border-court-200/70 pt-3 dark:border-court-700/70">
        <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
          🔎 {open ? t('rank.lookupClose') : t('rank.lookup')}
        </Button>

        {open ? (
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-court-700 dark:text-court-200">
                {t('rank.searchLabel')}
              </label>
              <div className="flex gap-2">
                <input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void runSearch()
                  }}
                  className={inputClass}
                  autoComplete="off"
                />
                <Button onClick={() => void runSearch()} disabled={busy !== null || !term.trim()}>
                  {busy === 'search' ? t('rank.searching') : t('rank.search')}
                </Button>
              </div>
            </div>

            {found && found.length > 0 ? (
              <div>
                <p className="mb-1.5 text-sm text-court-600 dark:text-court-200">
                  {found.length > 1 ? t('rank.pickOne') : t('rank.oneFound')}
                </p>
                <ul className="divide-y divide-court-200/70 overflow-hidden rounded-xl bg-white dark:divide-court-700/70 dark:bg-court-900">
                  {found.map((match) => (
                    <li key={match.tttmId}>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void apply(match)}
                        className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-start
                          transition hover:bg-court-50 disabled:opacity-50 dark:hover:bg-court-800"
                      >
                        {match.photo ? (
                          // Decorative: the name is right next to it. Routed through
                          // the same image relay the saved photograph goes through,
                          // so browsing the list tells TTTM nothing.
                          <img
                            src={photoThumbUrl(match.photo, 96)}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-full object-cover"
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
              </div>
            ) : null}

            {problem ? (
              <p className="rounded-xl bg-ball-500/12 px-3 py-2 text-sm text-ball-600">
                {t(problem as 'rank.none')}
              </p>
            ) : null}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-court-700 dark:text-court-200">
                {t('rank.linkLabel')}
              </label>
              <div className="flex gap-2">
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void runLink()
                  }}
                  dir="ltr"
                  placeholder={t('rank.linkPlaceholder')}
                  className={inputClass}
                  autoComplete="off"
                />
                <Button
                  variant="subtle"
                  onClick={() => void runLink()}
                  disabled={busy !== null || !link.trim()}
                >
                  {busy === 'link' ? t('rank.searching') : t('rank.fetch')}
                </Button>
              </div>
            </div>

            {/* Said here rather than buried in settings, because this is the control
                that does it and the moment it happens. */}
            <p className="text-sm text-court-500 dark:text-court-300">{t('rank.relayNote')}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
