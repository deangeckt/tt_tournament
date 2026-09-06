import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { navigate, useRouteStep } from '../router'
import { newId, useAppStore } from '../store/useAppStore'
import { ranksOrNone } from '../store/ranks'
import { generateSeed } from '../engine/rng'
import { suggestedConfig, validateConfig } from '../engine/advisor'
import type {
  BestOf,
  FormatConfig,
  Level,
  Player,
  PlayerId,
  ScoreMode,
  Tournament,
} from '../engine/types'
import { Button, Card, Chip, Field, PageTitle, inputClass } from '../components/common/ui'
import { Tooltip } from '../components/common/Tooltip'
import { toast } from '../store/useToasts'
import type { TFunction } from 'i18next'
import { levelDefaultName } from '../i18n/levelName'
import { PlayerPicker } from '../components/wizard/PlayerPicker'
import { FormatPicker } from '../components/wizard/FormatPicker'

interface DraftLevel {
  key: string
  name: string
  playerIds: PlayerId[]
  config: FormatConfig
  bestOf: BestOf
  /**
   * The manager picked this format themselves. Until they do, the level follows the
   * recommendation for its own field size — otherwise a second level silently stays
   * the round robin it was born as while the first one draws groups.
   */
  formatChosen: boolean
}

function emptyLevel(index: number, t: TFunction): DraftLevel {
  return {
    key: newId(),
    name: levelDefaultName(index, t),
    playerIds: [],
    config: suggestedConfig(0),
    bestOf: 5,
    formatChosen: false,
  }
}

/** Set a level's players, keeping an unchosen format on the recommendation. */
function withPlayers(level: DraftLevel, playerIds: PlayerId[]): DraftLevel {
  return {
    ...level,
    playerIds,
    config: level.formatChosen ? level.config : suggestedConfig(playerIds.length),
  }
}

/**
 * Turn the finished draft into the tournament that gets saved.
 *
 * Outside the component on purpose: it stamps timestamps and mints a seed per level,
 * neither of which belongs anywhere near a render.
 */
function buildTournament(
  draft: {
    name: string
    date: string
    scoreMode: ScoreMode
    tableCount: number
    levels: DraftLevel[]
  },
  roster: readonly Player[],
): Tournament {
  const usedIds = new Set(draft.levels.flatMap((l) => l.playerIds))
  const now = Date.now()
  return {
    id: newId(),
    name: draft.name.trim(),
    date: draft.date,
    scoreMode: draft.scoreMode,
    tableCount: draft.tableCount,
    // Slim copies: a tournament needs a name to print, not a roster photo. Keeping
    // photos out here is what lets the whole thing fit in a share link.
    players: roster.filter((p) => usedIds.has(p.id)).map(({ id, name }) => ({ id, name })),
    levels: draft.levels.map<Level>((level) => ({
      id: level.key,
      name: level.name,
      playerIds: level.playerIds,
      config: level.config,
      bestOf: level.bestOf,
      seed: generateSeed(),
      withdrawn: [],
      // Frozen here, at the only moment this level is ever drawn for the first time.
      // From now on the level keeps these numbers however often TTTM revises them,
      // so tonight's bracket is still tonight's bracket when it is read back in June.
      ranks: ranksOrNone(level.playerIds, roster),
    })),
    results: {},
    tableAssignments: {},
    createdAt: now,
    updatedAt: now,
  }
}

const STAGES = ['nameStep', 'playersStep', 'formatStep'] as const

/**
 * The three-stage setup wizard: details, players, format.
 *
 * The route step is not quite the stage. Steps 0 and 1 are the first two stages; step
 * 2 and every step after it are the *format stage, one level at a time* — so a night
 * with three levels answers the format question three times, and Back walks back
 * through them level by level rather than dropping out of the stage.
 *
 * Levels are created and staffed in stage 2 and nowhere else. Offering "+ Level" again
 * on a format screen only raises the question of what a level added there is meant to
 * contain, and it lets a manager reach Create having never seen the new level's format.
 */
export function NewTournament() {
  const { t } = useTranslation()
  const roster = useAppStore((s) => s.roster)
  const saveTournament = useAppStore((s) => s.saveTournament)

  const [step, goToStep] = useRouteStep()
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [scoreMode, setScoreMode] = useState<ScoreMode>('quick')
  const [tableCount, setTableCount] = useState(4)
  const [levels, setLevels] = useState<DraftLevel[]>(() => [emptyLevel(0, t)])
  const [activeLevel, setActiveLevel] = useState(0)

  // Keyed rather than indexed: the format stage walks the levels that have players,
  // whose positions are not the positions in `levels`.
  const patchLevel = (key: string, patch: Partial<DraftLevel>) =>
    setLevels((prev) => prev.map((level) => (level.key === key ? { ...level, ...patch } : level)))

  /**
   * Give a player to one level, taking them out of whichever level held them.
   *
   * A player belongs to exactly one level, so moving and adding are the same
   * operation — which is what lets the picker offer someone already spoken for
   * instead of hiding them and leaving the manager to hunt for the level they are in.
   */
  const assign = (playerId: PlayerId, targetIndex: number) =>
    setLevels((prev) =>
      prev.map((level, i) => {
        if (i === targetIndex) {
          return level.playerIds.includes(playerId)
            ? level
            : withPlayers(level, [...level.playerIds, playerId])
        }
        return level.playerIds.includes(playerId)
          ? withPlayers(level, level.playerIds.filter((id) => id !== playerId))
          : level
      }),
    )

  /** Players held by another level, mapped to the name of the level holding them. */
  const elsewhere = (index: number) =>
    new Map(
      levels.flatMap((level, i) =>
        i === index ? [] : level.playerIds.map((id) => [id, level.name] as const),
      ),
    )

  // A level nobody was put in is a level the manager added and thought better of, not
  // a tournament that cannot be created: it is dropped rather than left holding the
  // Create button down. It is not asked a format question either — there is no field
  // to answer it about.
  const staffed = levels.filter((level) => level.playerIds.length > 0)
  const problems = staffed.map((level) => validateConfig(level.config, level.playerIds.length))
  const canCreate = name.trim().length > 0 && staffed.length > 0 && problems.every((p) => p === null)

  const stage = Math.min(step, 2)
  const formatIndex = Math.min(Math.max(step - 2, 0), Math.max(staffed.length - 1, 0))
  const formatLevel = staffed[formatIndex]
  /** The step holding the last level's format — the one that offers Create. */
  const lastStep = 2 + Math.max(staffed.length - 1, 0)

  const picking = levels[activeLevel]
  const recommended = suggestedConfig(formatLevel?.playerIds.length ?? 0).format

  const create = async () => {
    const tournament = buildTournament(
      { name, date, scoreMode, tableCount, levels: staffed },
      roster,
    )
    await saveTournament(tournament)
    toast(t('feedback.tournamentCreated'))
    navigate({ name: 'run', id: tournament.id })
  }

  const heading =
    stage === 2 && formatLevel && staffed.length > 1
      ? t('wizard.formatFor', { name: formatLevel.name })
      : t(`wizard.${STAGES[stage]}`)

  const subLine =
    stage === 2 && staffed.length > 1
      ? `${t('wizard.step', { current: 3, total: STAGES.length })} · ${t('wizard.levelStep', {
          current: formatIndex + 1,
          total: staffed.length,
        })}`
      : t('wizard.step', { current: stage + 1, total: STAGES.length })

  // Walking past a level whose field cannot support the format it was given would
  // leave the reason on a screen the manager has already left, so the walk stops on
  // the level that has the problem.
  const currentProblem = formatLevel
    ? validateConfig(formatLevel.config, formatLevel.playerIds.length)
    : null
  const nextDisabled =
    step === 0 ? !name.trim() : step === 1 ? staffed.length === 0 : currentProblem !== null

  return (
    <>
      <PageTitle sub={subLine}>{heading}</PageTitle>

      {step === 0 ? (
        <Card className="space-y-4">
          <Field label={t('wizard.nameLabel')}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('wizard.namePlaceholder')}
              className={inputClass}
              autoFocus
            />
          </Field>
          <Field label={t('wizard.dateLabel')}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={t('wizard.scoreMode')}>
            <div className="grid grid-cols-2 gap-2">
              {(['quick', 'detailed'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setScoreMode(mode)}
                  aria-pressed={scoreMode === mode}
                  className={`rounded-xl p-3 text-start transition ${
                    scoreMode === mode
                      ? 'bg-court-600/10 ring-2 ring-court-500'
                      : 'bg-white ring-1 ring-court-200 hover:ring-court-300 dark:bg-court-900 dark:ring-court-700'
                  }`}
                >
                  <div className="font-medium">
                    {mode === 'quick' ? '⚡ ' : '🏓 '}
                    {t(`wizard.scoreMode${mode === 'quick' ? 'Quick' : 'Detailed'}`)}
                  </div>
                  <div className="mt-0.5 text-xs text-court-600 dark:text-court-200">
                    {t(`wizard.scoreMode${mode === 'quick' ? 'Quick' : 'Detailed'}Hint`)}
                  </div>
                </button>
              ))}
            </div>
          </Field>
          <Field label={t('wizard.tables')}>
            <input
              type="number"
              min={1}
              max={40}
              value={tableCount}
              onChange={(e) => setTableCount(Math.max(1, Number(e.target.value) || 1))}
              className={inputClass}
            />
          </Field>
        </Card>
      ) : null}

      {/* Stage 2: the levels themselves — add one, drop one, fill each with players.
          This is the only screen where a level comes into existence. */}
      {step === 1 ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {levels.map((level, i) => (
              <Tooltip
                key={level.key}
                label={t('wizard.levelTab', { name: level.name, count: level.playerIds.length })}
              >
                <Chip selected={i === activeLevel} onClick={() => setActiveLevel(i)}>
                  {level.name} · {level.playerIds.length}
                </Chip>
              </Tooltip>
            ))}
            <Tooltip label={t('wizard.addLevelHint')}>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => {
                  setLevels((prev) => [...prev, emptyLevel(prev.length, t)])
                  setActiveLevel(levels.length)
                }}
              >
                + {t('wizard.addLevel')}
              </Button>
            </Tooltip>
            {levels.length > 1 ? (
              <Tooltip label={t('wizard.removeLevelHint')}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLevels((prev) => prev.filter((_, i) => i !== activeLevel))
                    setActiveLevel(0)
                  }}
                >
                  ✕
                </Button>
              </Tooltip>
            ) : null}
          </div>

          {picking ? (
            <Card>
              <PlayerPicker
                selected={picking.playerIds}
                elsewhere={elsewhere(activeLevel)}
                onChange={(ids) =>
                  setLevels((prev) =>
                    prev.map((level, i) => (i === activeLevel ? withPlayers(level, ids) : level)),
                  )
                }
                onAssign={(id) => assign(id, activeLevel)}
              />
            </Card>
          ) : null}
        </>
      ) : null}

      {/* Stage 3: one level per step. The chips say how far the walk has got and jump
          back to a level already answered; they do not add or remove one. */}
      {step >= 2 && formatLevel ? (
        <>
          {staffed.length > 1 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {staffed.map((level, i) => (
                <Tooltip
                  key={level.key}
                  label={t('wizard.levelTab', { name: level.name, count: level.playerIds.length })}
                >
                  <Chip selected={i === formatIndex} onClick={() => goToStep(2 + i)}>
                    {level.name} · {level.playerIds.length}
                  </Chip>
                </Tooltip>
              ))}
            </div>
          ) : null}

          {/* Match length sits with the format because it is the other half of the
              same decision — best of 3 across 24 players is a different evening from
              best of 5 — and the duration advice below reacts to it. */}
          <div className="mb-4">
            <span className="mb-2 block font-medium text-court-700 dark:text-court-200">
              {t('wizard.bestOf')}
            </span>
            <div className="flex flex-wrap gap-2">
              {([3, 5, 7] as const).map((value) => (
                <Chip
                  key={value}
                  selected={formatLevel.bestOf === value}
                  onClick={() => patchLevel(formatLevel.key, { bestOf: value })}
                >
                  {t('wizard.bestOfValue', { count: value })}
                </Chip>
              ))}
            </div>
            <p className="mt-1.5 text-sm text-court-500 dark:text-court-300">
              {t('wizard.bestOfHint')}
            </p>
          </div>
          <FormatPicker
            value={formatLevel.config}
            playerCount={formatLevel.playerIds.length}
            bestOf={formatLevel.bestOf}
            tableCount={tableCount}
            recommended={recommended}
            onChange={(config) => patchLevel(formatLevel.key, { config, formatChosen: true })}
          />
        </>
      ) : null}

      <div className="mt-6 flex gap-2">
        <Button
          variant="subtle"
          onClick={() => (step === 0 ? navigate({ name: 'home' }) : goToStep(step - 1))}
        >
          {step === 0 ? t('common.cancel') : t('common.previous')}
        </Button>
        <div className="flex-1" />
        {step < lastStep ? (
          <Button onClick={() => goToStep(step + 1)} disabled={nextDisabled}>
            {t('common.next')}
          </Button>
        ) : (
          <Button onClick={() => void create()} disabled={!canCreate}>
            {t('wizard.createIt')}
          </Button>
        )}
      </div>
    </>
  )
}
