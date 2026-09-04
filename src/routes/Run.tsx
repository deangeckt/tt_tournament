import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../store/useAppStore'
import { resolveLevel, type MatchView } from '../engine/resolve'
import type { MatchResult, PlayerId } from '../engine/types'
import { Button, Card, Ltr, PageTitle } from '../components/common/ui'
import { GroupTable } from '../components/group/GroupTable'
import { MatchCard } from '../components/match/MatchCard'
import { participantLabel } from '../components/match/labels'
import { ScoreSheet } from '../components/score/ScoreSheet'
import { navigate } from '../router'

export function Run({ id }: { id: string }) {
  const { t } = useTranslation()
  const current = useAppStore((s) => s.current)
  const openTournament = useAppStore((s) => s.openTournament)
  const setResult = useAppStore((s) => s.setResult)
  const clearResult = useAppStore((s) => s.clearResult)

  const [activeLevel, setActiveLevel] = useState(0)
  const [editing, setEditing] = useState<MatchView | null>(null)

  useEffect(() => {
    if (current?.id !== id) void openTournament(id)
  }, [id, current?.id, openTournament])

  const level = current?.levels[activeLevel]

  const view = useMemo(
    () => (current && level ? resolveLevel(level, current.results, current.scoreMode) : null),
    [current, level],
  )

  const nameOf = useMemo(() => {
    const names = new Map(current?.players.map((p) => [p.id, p.name]) ?? [])
    return (playerId: PlayerId) => names.get(playerId) ?? playerId
  }, [current])

  if (!current) return null
  if (!view || !level) return null

  const ready = view.matches.filter((m) => m.playable && !m.result)
  const advancing =
    level.config.format === 'groupsKnockout' ? level.config.advancePerGroup : 0
  const bracket = view.matches.filter((m) => m.match.stage !== 'group')

  const save = async (result: MatchResult) => {
    if (!editing || editing.a.kind !== 'player' || editing.b.kind !== 'player') return
    await setResult(editing.match.id, result, [editing.a.playerId, editing.b.playerId])
    setEditing(null)
  }

  return (
    <>
      <div className="no-print mb-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'home' })}>
          ← {t('nav.back')}
        </Button>
      </div>

      <PageTitle sub={t('run.progress', { played: view.played, total: view.total })}>
        {current.name}
      </PageTitle>

      {current.levels.length > 1 ? (
        <div className="no-print mb-4 flex flex-wrap gap-2">
          {current.levels.map((lvl, i) => (
            <button
              key={lvl.id}
              type="button"
              onClick={() => setActiveLevel(i)}
              aria-pressed={i === activeLevel}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                i === activeLevel
                  ? 'bg-court-600 text-white'
                  : 'bg-court-100 text-court-700 dark:bg-court-800 dark:text-court-100'
              }`}
            >
              {lvl.name}
            </button>
          ))}
        </div>
      ) : null}

      {view.champion ? (
        <Card className="mb-4 bg-ball-500/15 text-center ring-ball-400/40">
          <div className="text-sm font-medium text-court-600 dark:text-court-100">
            {t('run.champion')}
          </div>
          <div className="mt-1 text-xl font-bold">{nameOf(view.champion)}</div>
        </Card>
      ) : null}

      {ready.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">{t('run.upNext')}</h2>
          <div className="space-y-2">
            {ready.slice(0, current.tableCount).map((match) => (
              <MatchCard
                key={match.match.id}
                view={match}
                nameOf={nameOf}
                groups={view.groups}
                bestOf={level.bestOf}
                scoreMode={current.scoreMode}
                onOpen={setEditing}
              />
            ))}
          </div>
        </section>
      ) : null}

      {view.groups.length > 0 ? (
        <section className="mb-6 space-y-4">
          <h2 className="font-semibold">{t('run.standings')}</h2>
          {view.groups.map((group) => (
            <div key={group.id} className="space-y-2">
              <GroupTable
                title={group.name}
                rows={view.standings.get(group.id) ?? []}
                nameOf={nameOf}
                advancing={advancing}
              />
              <div className="space-y-1.5">
                {view.matches
                  .filter((m) => m.match.groupId === group.id)
                  .map((match) => (
                    <MatchCard
                      key={match.match.id}
                      view={match}
                      nameOf={nameOf}
                      groups={view.groups}
                      bestOf={level.bestOf}
                      scoreMode={current.scoreMode}
                      onOpen={setEditing}
                    />
                  ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {bracket.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">{t('run.bracket')}</h2>
          <div className="space-y-4">
            {[...new Set(bracket.map((m) => m.match.round))].sort((a, b) => a - b).map((round) => (
              <div key={round}>
                <div className="mb-1.5 text-xs font-medium text-court-500 dark:text-court-300">
                  <Ltr>{round + 1}</Ltr>
                </div>
                <div className="space-y-1.5">
                  {bracket
                    .filter((m) => m.match.round === round && !m.auto && !m.vacant)
                    .map((match) => (
                      <MatchCard
                        key={match.match.id}
                        view={match}
                        nameOf={nameOf}
                        groups={view.groups}
                        bestOf={level.bestOf}
                        scoreMode={current.scoreMode}
                        onOpen={setEditing}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Card className="no-print text-sm text-court-600 dark:text-court-200">
        <div className="font-medium">{t('run.seedLabel')}</div>
        <div className="mt-1 text-lg font-semibold text-court-900 dark:text-court-50">
          <Ltr>{level.seed}</Ltr>
        </div>
        <p className="mt-1">{t('run.seedHint')}</p>
      </Card>

      <ScoreSheet
        open={editing !== null}
        nameA={editing ? participantLabel(editing.a, nameOf, view.groups, t) : ''}
        nameB={editing ? participantLabel(editing.b, nameOf, view.groups, t) : ''}
        bestOf={level.bestOf}
        scoreMode={current.scoreMode}
        existing={editing?.result}
        onSave={(result) => void save(result)}
        onClear={() => {
          if (editing) void clearResult(editing.match.id)
          setEditing(null)
        }}
        onClose={() => setEditing(null)}
      />
    </>
  )
}
