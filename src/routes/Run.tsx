import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { useAppStore } from '../store/useAppStore'
import { resolveLevel, type MatchView } from '../engine/resolve'
import type { MatchId, MatchResult, PlayerId, StoredResult } from '../engine/types'
import { Button, Card, Chip, Ltr, PageTitle } from '../components/common/ui'
import { GroupTable } from '../components/group/GroupTable'
import { MatchCard } from '../components/match/MatchCard'
import { participantLabel } from '../components/match/labels'
import { ScoreSheet } from '../components/score/ScoreSheet'
import { EditSheet } from '../components/tournament/EditSheet'
import { Tooltip } from '../components/common/Tooltip'
import { toast } from '../store/useToasts'
import { navigate } from '../router'

export function Run({ id }: { id: string }) {
  const { t } = useTranslation()
  const current = useAppStore((s) => s.current)
  const openTournament = useAppStore((s) => s.openTournament)
  const setResult = useAppStore((s) => s.setResult)
  const clearResult = useAppStore((s) => s.clearResult)

  const [activeLevel, setActiveLevel] = useState(0)
  const [editing, setEditing] = useState<MatchView | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  /** The match whose score changed most recently, and when — drives the highlight. */
  const [lastChange, setLastChange] = useState<{ id: MatchId; at: number } | null>(null)

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

  if (!current || !view || !level) return null

  const ready = view.matches.filter((m) => m.playable && !m.result)
  const advancing = level.config.format === 'groupsKnockout' ? level.config.advancePerGroup : 0
  const bracket = view.matches.filter((m) => m.match.stage !== 'group')
  const progress = view.total > 0 ? Math.round((view.played / view.total) * 100) : 0

  /** Restore a previous result, or clear the match if there wasn't one. */
  const restore = (matchId: MatchId, previous: StoredResult | undefined) => {
    setLastChange({ id: matchId, at: Date.now() })
    if (previous) void setResult(matchId, previous.result, previous.playedBy)
    else void clearResult(matchId)
  }

  const save = async (result: MatchResult) => {
    if (!editing || editing.a.kind !== 'player' || editing.b.kind !== 'player') return
    const matchId = editing.match.id
    const previous = current.results[matchId]
    setEditing(null)
    setLastChange({ id: matchId, at: Date.now() })
    await setResult(matchId, result, [editing.a.playerId, editing.b.playerId])
    toast(t('feedback.scoreSaved'), 'success', {
      label: t('feedback.undo'),
      run: () => restore(matchId, previous),
    })
  }

  const remove = async () => {
    if (!editing) return
    const matchId = editing.match.id
    const previous = current.results[matchId]
    setEditing(null)
    setLastChange({ id: matchId, at: Date.now() })
    await clearResult(matchId)
    toast(t('feedback.scoreCleared'), 'warn', {
      label: t('feedback.undo'),
      run: () => restore(matchId, previous),
    })
  }

  const cardProps = (matchId: MatchId) => ({
    nameOf,
    groups: view.groups,
    bestOf: level.bestOf,
    scoreMode: current.scoreMode,
    flashKey: lastChange?.id === matchId ? lastChange.at : undefined,
    onOpen: setEditing,
  })

  return (
    <>
      <div className="no-print mb-2 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'home' })}>
          ← {t('nav.back')}
        </Button>
        <div className="flex-1" />
        <Tooltip label={t('edit.openHint')}>
          <Button variant="subtle" size="sm" onClick={() => setEditOpen(true)}>
            ✎ {t('edit.open')}
          </Button>
        </Tooltip>
      </div>

      <PageTitle sub={t('run.progress', { played: view.played, total: view.total })}>
        {current.name}
      </PageTitle>

      {/* A progress bar turns every saved score into a visible move forward. */}
      <div className="no-print mb-5 h-2 overflow-hidden rounded-full bg-court-100 dark:bg-court-800">
        <motion.div
          className="h-full rounded-full bg-court-500"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 220, damping: 30 }}
        />
      </div>

      {current.levels.length > 1 ? (
        <div className="no-print mb-5 flex flex-wrap gap-2">
          {current.levels.map((lvl, i) => (
            <Chip key={lvl.id} selected={i === activeLevel} onClick={() => setActiveLevel(i)}>
              {lvl.name}
            </Chip>
          ))}
        </div>
      ) : null}

      {view.champion ? (
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <Card className="mb-5 bg-ball-500/15 text-center ring-ball-400/40">
            <div className="text-sm font-medium text-court-600 dark:text-court-100">
              🏆 {t('run.champion')}
            </div>
            <div className="mt-1 text-2xl font-bold">{nameOf(view.champion)}</div>
          </Card>
        </motion.div>
      ) : null}

      {ready.length > 0 ? (
        <section className="mb-7">
          <h2 className="mb-3 text-lg font-bold">{t('run.upNext')}</h2>
          <div className="space-y-2">
            {ready.slice(0, current.tableCount).map((match) => (
              <MatchCard key={match.match.id} view={match} {...cardProps(match.match.id)} />
            ))}
          </div>
        </section>
      ) : null}

      {view.groups.length > 0 ? (
        <section className="mb-7 space-y-5">
          <h2 className="text-lg font-bold">{t('run.standings')}</h2>
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
                    <MatchCard key={match.match.id} view={match} {...cardProps(match.match.id)} />
                  ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {bracket.length > 0 ? (
        <section className="mb-7">
          <h2 className="mb-3 text-lg font-bold">{t('run.bracket')}</h2>
          <div className="space-y-4">
            {[...new Set(bracket.map((m) => m.match.round))]
              .sort((a, b) => a - b)
              .map((round) => (
                <div key={round}>
                  <div className="mb-1.5 text-sm font-medium text-court-500 dark:text-court-300">
                    <Ltr>{round + 1}</Ltr>
                  </div>
                  <div className="space-y-1.5">
                    {bracket
                      .filter((m) => m.match.round === round && !m.auto && !m.vacant)
                      .map((match) => (
                        <MatchCard key={match.match.id} view={match} {...cardProps(match.match.id)} />
                      ))}
                  </div>
                </div>
              ))}
          </div>
        </section>
      ) : null}

      <Card className="no-print text-court-600 dark:text-court-200">
        <div className="font-medium">{t('run.seedLabel')}</div>
        <div className="mt-1 text-xl font-bold text-court-900 dark:text-court-50">
          <Ltr>{level.seed}</Ltr>
        </div>
        <p className="mt-1 text-sm">{t('run.seedHint')}</p>
      </Card>

      <ScoreSheet
        matchKey={editing?.match.id}
        open={editing !== null}
        nameA={editing ? participantLabel(editing.a, nameOf, view.groups, t) : ''}
        nameB={editing ? participantLabel(editing.b, nameOf, view.groups, t) : ''}
        bestOf={level.bestOf}
        scoreMode={current.scoreMode}
        existing={editing?.result}
        onSave={(result) => void save(result)}
        onClear={() => void remove()}
        onClose={() => setEditing(null)}
      />

      <EditSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        tournament={current}
        level={level}
        playedCount={view.played}
      />
    </>
  )
}
