import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { navigate } from '../router'
import { newId, useAppStore } from '../store/useAppStore'
import { generateSeed } from '../engine/rng'
import { suggestedConfig, validateConfig } from '../engine/advisor'
import type { BestOf, FormatConfig, Level, PlayerId, ScoreMode, Tournament } from '../engine/types'
import { Button, Card, Field, PageTitle, inputClass } from '../components/common/ui'
import { PlayerPicker } from '../components/wizard/PlayerPicker'
import { FormatPicker } from '../components/wizard/FormatPicker'

interface DraftLevel {
  key: string
  name: string
  playerIds: PlayerId[]
  config: FormatConfig
  bestOf: BestOf
}

const LEVEL_NAMES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳']

function emptyLevel(index: number): DraftLevel {
  return {
    key: newId(),
    name: LEVEL_NAMES[index] ?? String(index + 1),
    playerIds: [],
    config: { format: 'roundRobin' },
    bestOf: 5,
  }
}

const STEPS = ['nameStep', 'playersStep', 'formatStep'] as const

export function NewTournament() {
  const { t } = useTranslation()
  const roster = useAppStore((s) => s.roster)
  const saveTournament = useAppStore((s) => s.saveTournament)

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [scoreMode, setScoreMode] = useState<ScoreMode>('quick')
  const [tableCount, setTableCount] = useState(4)
  const [levels, setLevels] = useState<DraftLevel[]>([emptyLevel(0)])
  const [activeLevel, setActiveLevel] = useState(0)

  const patchLevel = (index: number, patch: Partial<DraftLevel>) =>
    setLevels((prev) => prev.map((level, i) => (i === index ? { ...level, ...patch } : level)))

  const takenBy = (index: number) =>
    new Set(levels.flatMap((level, i) => (i === index ? [] : level.playerIds)))

  const totalPlayers = levels.reduce((sum, level) => sum + level.playerIds.length, 0)
  const problems = levels.map((level) => validateConfig(level.config, level.playerIds.length))
  const canCreate = name.trim().length > 0 && totalPlayers > 0 && problems.every((p) => p === null)

  const create = async () => {
    const usedIds = new Set(levels.flatMap((l) => l.playerIds))
    const tournament: Tournament = {
      id: newId(),
      name: name.trim(),
      date,
      scoreMode,
      tableCount,
      players: roster.filter((p) => usedIds.has(p.id)),
      levels: levels.map<Level>((level) => ({
        id: level.key,
        name: level.name,
        playerIds: level.playerIds,
        config: level.config,
        bestOf: level.bestOf,
        seed: generateSeed(),
        withdrawn: [],
      })),
      results: {},
      tableAssignments: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await saveTournament(tournament)
    navigate({ name: 'run', id: tournament.id })
  }

  const current = levels[activeLevel]
  const recommended = useMemo(
    () => suggestedConfig(current?.playerIds.length ?? 0).format,
    [current?.playerIds.length],
  )

  return (
    <>
      <PageTitle sub={t('wizard.step', { current: step + 1, total: STEPS.length })}>
        {t(`wizard.${STEPS[step]}`)}
      </PageTitle>

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
                      : 'bg-court-100 ring-1 ring-transparent dark:bg-court-800'
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

      {step > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {levels.map((level, i) => (
            <button
              key={level.key}
              type="button"
              onClick={() => setActiveLevel(i)}
              aria-pressed={i === activeLevel}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                i === activeLevel
                  ? 'bg-court-600 text-white'
                  : 'bg-court-100 text-court-700 dark:bg-court-800 dark:text-court-100'
              }`}
            >
              {level.name} · {level.playerIds.length}
            </button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLevels((prev) => [...prev, emptyLevel(prev.length)])
              setActiveLevel(levels.length)
            }}
          >
            +
          </Button>
          {levels.length > 1 ? (
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
          ) : null}
        </div>
      ) : null}

      {step === 1 && current ? (
        <Card>
          <PlayerPicker
            selected={current.playerIds}
            taken={takenBy(activeLevel)}
            onChange={(ids) => patchLevel(activeLevel, { playerIds: ids })}
          />
        </Card>
      ) : null}

      {step === 2 && current ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {([3, 5, 7] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => patchLevel(activeLevel, { bestOf: value })}
                aria-pressed={current.bestOf === value}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  current.bestOf === value
                    ? 'bg-court-600 text-white'
                    : 'bg-court-100 text-court-700 dark:bg-court-800 dark:text-court-100'
                }`}
              >
                {t('wizard.bestOfValue', { count: value })}
              </button>
            ))}
          </div>
          <FormatPicker
            value={current.config}
            playerCount={current.playerIds.length}
            bestOf={current.bestOf}
            recommended={recommended}
            onChange={(config) => patchLevel(activeLevel, { config })}
          />
        </>
      ) : null}

      <div className="mt-6 flex gap-2">
        <Button
          variant="subtle"
          onClick={() => (step === 0 ? navigate({ name: 'home' }) : setStep(step - 1))}
        >
          {step === 0 ? t('common.cancel') : t('common.previous')}
        </Button>
        <div className="flex-1" />
        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={step === 0 ? !name.trim() : totalPlayers === 0}
          >
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
