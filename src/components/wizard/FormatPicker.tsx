import { useTranslation } from 'react-i18next'
import type { BestOf, FormatConfig, FormatName } from '../../engine/types'
import {
  consolationConfig,
  consolationFieldSize,
  describe,
  groupSizes,
  minimumPlayers,
  suggestGroupCount,
  validateConfig,
} from '../../engine/advisor'
import { FormatDiagram } from './FormatDiagram'
import { Chip, Ltr } from '../common/ui'

const ORDER: FormatName[] = ['groupsKnockout', 'roundRobin', 'singleElim', 'doubleElim']

function defaultConfigFor(format: FormatName, playerCount: number): FormatConfig {
  if (format === 'groupsKnockout') {
    return {
      format,
      groupCount: suggestGroupCount(playerCount),
      advancePerGroup: 2,
    }
  }
  return { format } as FormatConfig
}

export function FormatPicker({
  value,
  playerCount,
  bestOf,
  tableCount,
  recommended,
  onChange,
}: {
  value: FormatConfig
  playerCount: number
  bestOf: BestOf
  tableCount: number
  recommended: FormatName
  onChange: (config: FormatConfig) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      {ORDER.map((format) => {
        const selected = value.format === format
        const config = selected ? value : defaultConfigFor(format, playerCount)
        const shape = describe(config, playerCount, bestOf, tableCount)
        const problem = validateConfig(config, playerCount)
        // Too small a field for this format at all — not a choice the user can make
        // yet, so lock the card rather than let them select an undrawable level.
        const locked = playerCount < minimumPlayers(format)
        const hours = shape.estimatedMinutes / 60

        const groupOptions = selected && !locked && config.format === 'groupsKnockout'
        const consolationOption = selected && !locked && !problem && supportsConsolation(config)

        return (
          // Card and options are one surface. They used to be separate boxes, and the
          // consolation switch below read as a format card of its own rather than as a
          // setting of the one above it — which is exactly how it got missed.
          <div
            key={format}
            className={`overflow-hidden rounded-2xl transition-all duration-150 ${
              locked
                ? 'bg-white opacity-55 ring-1 ring-court-100 dark:bg-court-900 dark:ring-court-800'
                : selected
                  ? 'bg-court-600/10 ring-2 ring-court-500 dark:bg-court-500/15'
                  : 'bg-white ring-1 ring-court-100 hover:-translate-y-px hover:ring-court-400 hover:shadow-md dark:bg-court-900 dark:ring-court-800'
            }`}
          >
            <button
              type="button"
              disabled={locked}
              onClick={() => onChange(defaultConfigFor(format, playerCount))}
              aria-pressed={selected}
              className={`flex w-full items-stretch gap-3 p-3 text-start transition-colors duration-150 ${
                locked
                  ? 'cursor-not-allowed'
                  : selected
                    ? 'active:scale-[0.99]'
                    : 'hover:bg-court-50 active:scale-[0.99] dark:hover:bg-court-800'
              }`}
            >
              <div className={`h-20 w-20 shrink-0 self-center sm:w-24 ${locked ? 'grayscale' : ''}`}>
                <FormatDiagram format={format} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{t(`format.${format}`)}</span>
                  {locked ? <LockIcon /> : null}
                  {!locked && format === recommended ? (
                    <span className="rounded-full bg-ball-500/20 px-2 py-0.5 text-xs font-medium text-ball-600">
                      ★
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm text-court-600 dark:text-court-200">
                  {t(`format.${format}Hint`)}
                </p>

                {problem ? (
                  // Locked is a requirement, not a mistake: red is reserved for a
                  // configuration the user actually chose and has to fix.
                  <p
                    className={`mt-2 text-sm font-medium ${
                      locked ? 'text-court-600 dark:text-court-200' : 'text-red-600'
                    }`}
                  >
                    {t('format.tooFew', { count: Math.max(problem.needed, minimumPlayers(format)) })}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-court-600 dark:text-court-200">
                    {t('format.matches', { count: shape.matchCount })} ·{' '}
                    {t('format.perPlayer', { count: shape.minMatchesPerPlayer })} ·{' '}
                    <Ltr>
                      {hours >= 1 ? `~${hours.toFixed(1)}h` : `~${shape.estimatedMinutes}m`}
                    </Ltr>
                  </p>
                )}
              </div>
            </button>

            {groupOptions || consolationOption ? (
              <div className="border-t border-court-500/25 px-3 py-3 dark:border-court-100/15">
                {groupOptions && config.format === 'groupsKnockout' ? (
                  <GroupOptions config={config} playerCount={playerCount} onChange={onChange} />
                ) : null}

                {consolationOption && supportsConsolation(config) ? (
                  <ConsolationOption
                    config={config}
                    playerCount={playerCount}
                    bestOf={bestOf}
                    tableCount={tableCount}
                    divided={groupOptions}
                    onChange={onChange}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/** The two formats that eliminate anybody, and so the two that can pick them up. */
type Eliminating = Extract<FormatConfig, { format: 'singleElim' | 'groupsKnockout' }>

function supportsConsolation(config: FormatConfig): config is Eliminating {
  return config.format === 'singleElim' || config.format === 'groupsKnockout'
}

/**
 * The consolation switch, under the format it belongs to.
 *
 * It sits here rather than beside the night's other settings because it is a question
 * about *this level's shape* — and because the card above recounts the matches and the
 * hours the moment it is pressed, which is the only warning anyone gets that they have
 * just made the evening half again as long.
 */
function ConsolationOption({
  config,
  playerCount,
  bestOf,
  tableCount,
  divided,
  onChange,
}: {
  config: Eliminating
  playerCount: number
  bestOf: BestOf
  tableCount: number
  /** Sits under the group options, so it needs a rule between them. */
  divided: boolean
  onChange: (next: FormatConfig) => void
}) {
  const { t } = useTranslation()
  const on = config.consolation === true
  const available = consolationConfig(config, consolationFieldSize(config, playerCount)) !== null
  const added =
    describe({ ...config, consolation: true }, playerCount, bestOf, tableCount).matchCount -
    describe({ ...config, consolation: false }, playerCount, bestOf, tableCount).matchCount

  return (
    <div
      className={
        divided ? 'mt-3 border-t border-court-500/25 pt-3 dark:border-court-100/15' : undefined
      }
    >
      {/*
        A switch, not a chip. An unselected chip looks like one option among several
        and says nothing about being off; a track with a knob says there are two
        states and which one you are in, and the word beside it says so in Hebrew too
        rather than leaving it to a colour.
      */}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={!available}
        onClick={() => onChange({ ...config, consolation: !on })}
        className={`flex min-h-11 w-full items-center gap-3 text-start ${
          available ? '' : 'cursor-not-allowed opacity-60'
        }`}
      >
        <span
          className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-150 ${
            on ? 'justify-end bg-court-500' : 'justify-start bg-court-300 dark:bg-court-700'
          }`}
        >
          <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-semibold">{t('format.consolation')}</span>
          <span
            className={`ms-2 text-sm font-medium ${
              on ? 'text-court-600 dark:text-court-200' : 'text-court-500 dark:text-court-300'
            }`}
          >
            {on ? t('format.consolationOn') : t('format.consolationOff')}
          </span>
        </span>
      </button>

      <p className="mt-1 text-sm text-court-600 dark:text-court-200">
        {available ? t('format.consolationHint') : t('format.consolationTooFew')}
      </p>
      {available && added > 0 ? (
        <p className="mt-1 text-sm font-medium text-court-500 dark:text-court-300">
          {t('format.consolationAdds', { n: added })}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Marks a format the current field is too small to run. Decorative only — the card
 * spells the requirement out in words beside it, since a glyph is not a reason.
 */
function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-court-500 dark:text-court-300"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function GroupOptions({
  config,
  playerCount,
  onChange,
}: {
  config: Extract<FormatConfig, { format: 'groupsKnockout' }>
  playerCount: number
  onChange: (config: FormatConfig) => void
}) {
  const { t } = useTranslation()
  // Only offer group counts that leave every group big enough to play.
  const options = Array.from({ length: 10 }, (_, i) => i + 2).filter(
    (count) => Math.floor(playerCount / count) >= config.advancePerGroup + 1,
  )
  const sizes = groupSizes(playerCount, config.groupCount)

  return (
    <div className="mt-2 rounded-xl bg-white p-3 ring-1 ring-court-100 dark:bg-court-900 dark:ring-court-800">
      <div className="flex flex-wrap items-center gap-2">
        {options.map((count) => (
          <Chip
            key={count}
            selected={count === config.groupCount}
            onClick={() => onChange({ ...config, groupCount: count })}
            className="text-sm"
          >
            {t('format.groups', { count })}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {[1, 2, 4].map((advance) => (
          <Chip
            key={advance}
            selected={advance === config.advancePerGroup}
            disabled={Math.min(...sizes) < advance + 1}
            onClick={() => onChange({ ...config, advancePerGroup: advance })}
            className="text-sm"
            title={
              Math.min(...sizes) < advance + 1 ? t('format.advanceBlocked', { count: advance }) : undefined
            }
          >
            {t('format.advance', { count: advance })}
          </Chip>
        ))}
      </div>
      <p className="mt-2 text-sm text-court-600 dark:text-court-200">
        <Ltr>{sizes.join(' · ')}</Ltr>
      </p>
    </div>
  )
}
