import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { decodeTournament } from '../share/payload'
import { planAdoption } from '../share/adopt'
import { resolveLevel } from '../engine/resolve'
import { tally } from '../engine/result'
import type { PlayerId } from '../engine/types'
import { useAppStore } from '../store/useAppStore'
import { Button, Card, PageTitle, Score } from '../components/common/ui'
import { GroupTable } from '../components/group/GroupTable'
import { participantLabel, roundLabel } from '../components/match/labels'
import { toast } from '../store/useToasts'
import { navigate } from '../router'

/**
 * A tournament read straight out of the link.
 *
 * Nothing is fetched and nothing is written: the payload decodes into the same
 * Tournament the engine works on everywhere else, and every table below is
 * recomputed here rather than travelling in the URL. Read-only on purpose — the
 * recipient is looking at somebody else's night, until they say otherwise.
 *
 * Saying otherwise is the second job of this screen: the club's tournaments do not
 * all get run on the same device, and this is where a night run on the spare tablet
 * joins the manager's real history.
 */
export function ViewShared({ payload }: { payload: string }) {
  const { t, i18n } = useTranslation()
  const roster = useAppStore((s) => s.roster)
  const tournaments = useAppStore((s) => s.tournaments)
  const adoptTournament = useAppStore((s) => s.adoptTournament)
  const restoreTournament = useAppStore((s) => s.restoreTournament)
  const tournament = useMemo(() => decodeTournament(payload), [payload])
  /**
   * Worked out before the button is pressed rather than after, because what adding is
   * about to do — recognise five of these people, add three, replace the copy already
   * here — is exactly what the manager needs to know while deciding.
   */
  const plan = useMemo(
    () => (tournament ? planAdoption(tournament, roster, tournaments) : null),
    [tournament, roster, tournaments],
  )

  if (!tournament) {
    return (
      <>
        <PageTitle sub={t('share.invalidHint')}>{t('share.invalid')}</PageTitle>
        <Button onClick={() => navigate({ name: 'home' })}>{t('nav.home')}</Button>
      </>
    )
  }

  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
  const nameOf = (id: PlayerId) => tournament.players.find((p) => p.id === id)?.name ?? id

  const adopt = async () => {
    if (!plan) return
    // The id travels with the tournament, so opening the same link twice updates the
    // one copy instead of filling the list with duplicates of one night.
    const previous = await adoptTournament(plan)
    toast(
      previous ? t('share.adoptReplaced') : t('share.adoptDone'),
      'success',
      // Only the replacing case destroys anything, and only that case has something
      // to put back.
      previous
        ? {
            label: t('feedback.undo'),
            run: () => {
              void restoreTournament(previous).then(() => toast(t('share.adoptUndone'), 'info'))
            },
          }
        : undefined,
    )
    navigate({ name: 'run', id: plan.tournament.id })
  }

  return (
    <>
      <div className="no-print mb-2 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'home' })}>
          ← {t('nav.home')}
        </Button>
      </div>

      <PageTitle sub={`${t('share.viewHint')} · ${dateFormat.format(new Date(tournament.date))}`}>
        {tournament.name}
      </PageTitle>

      {plan ? (
        <Card className="no-print mb-6 space-y-3">
          <div>
            <h2 className="text-lg font-bold">{t('share.adoptTitle')}</h2>
            <p className="mt-1 text-court-600 dark:text-court-200">{t('share.adoptHint')}</p>
          </div>
          <ul className="space-y-1 text-sm text-court-600 dark:text-court-200">
            {plan.matched > 0 ? (
              <li>✓ {t('share.adoptMatched', { count: plan.matched })}</li>
            ) : null}
            {plan.newPlayers.length > 0 ? (
              <li>+ {t('share.adoptNew', { count: plan.newPlayers.length })}</li>
            ) : null}
            {plan.replaces ? (
              <li className="font-medium text-ball-600">⚠ {t('share.adoptReplaces')}</li>
            ) : null}
          </ul>
          <Button onClick={() => void adopt()}>⬇ {t('share.adopt')}</Button>
        </Card>
      ) : null}

      {tournament.levels.map((level) => {
        const view = resolveLevel(level, tournament.results, tournament.scoreMode)
        const bracket = view.matches.filter((m) => m.match.stage !== 'group' && !m.auto && !m.vacant)
        const lastRound = bracket.reduce((max, m) => Math.max(max, m.match.round), 0)
        const advancing =
          level.config.format === 'groupsKnockout' ? level.config.advancePerGroup : 0

        return (
          <section key={level.id} className="mb-7 space-y-4">
            {tournament.levels.length > 1 ? (
              <h2 className="text-lg font-bold">{level.name}</h2>
            ) : null}

            {view.champion ? (
              <Card className="bg-ball-500/15 text-center ring-ball-400/40">
                <div className="text-sm font-medium text-court-600 dark:text-court-100">
                  🏆 {t('run.champion')}
                </div>
                <div className="mt-1 text-2xl font-bold">{nameOf(view.champion)}</div>
              </Card>
            ) : null}

            {view.groups.map((group) => (
              <GroupTable
                key={group.id}
                title={group.name}
                rows={view.standings.get(group.id) ?? []}
                nameOf={nameOf}
                advancing={advancing}
              />
            ))}

            {bracket.length > 0 ? (
              <div>
                <h3 className="mb-2 font-bold">{t('run.bracket')}</h3>
                <div className="space-y-3">
                  {[...new Set(bracket.map((m) => m.match.round))]
                    .sort((a, b) => a - b)
                    .map((round) => (
                      <div key={round}>
                        <div className="mb-1.5 text-sm font-medium text-court-500 dark:text-court-300">
                          {roundLabel(round, lastRound, t)}
                        </div>
                        <ul className="divide-y divide-court-100 overflow-hidden rounded-xl bg-white ring-1 ring-court-100 dark:divide-court-800 dark:bg-court-900 dark:ring-court-800">
                          {bracket
                            .filter((m) => m.match.round === round)
                            .map((match) => {
                              const result = match.result
                                ? tally(match.result, level.bestOf)
                                : undefined
                              return (
                                <li
                                  key={match.match.id}
                                  className="flex items-center gap-3 px-4 py-3"
                                >
                                  <span
                                    className={`min-w-0 flex-1 truncate ${
                                      result?.winner === 'a' ? 'font-bold' : ''
                                    }`}
                                  >
                                    {participantLabel(match.a, nameOf, view.groups, t)}
                                  </span>
                                  {result ? (
                                    <Score
                                      a={result.gamesA}
                                      b={result.gamesB}
                                      className="shrink-0 font-bold"
                                    />
                                  ) : (
                                    <span className="shrink-0 text-court-400">–</span>
                                  )}
                                  <span
                                    className={`min-w-0 flex-1 truncate text-end ${
                                      result?.winner === 'b' ? 'font-bold' : ''
                                    }`}
                                  >
                                    {participantLabel(match.b, nameOf, view.groups, t)}
                                  </span>
                                </li>
                              )
                            })}
                        </ul>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}
          </section>
        )
      })}
    </>
  )
}
