import { useTranslation } from 'react-i18next'
import type { BestOf, FormatConfig, FormatName } from '../../engine/types'
import { describe, groupSizes, minimumPlayers, suggestGroupCount, validateConfig } from '../../engine/advisor'
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

        return (
          <div key={format}>
            <button
              type="button"
              disabled={locked}
              onClick={() => onChange(defaultConfigFor(format, playerCount))}
              aria-pressed={selected}
              className={`flex w-full items-stretch gap-3 rounded-2xl p-3 text-start transition-all duration-150 ${
                locked
                  ? 'cursor-not-allowed bg-white opacity-55 ring-1 ring-court-100 dark:bg-court-900 dark:ring-court-800'
                  : selected
                    ? 'bg-court-600/10 ring-2 ring-court-500 active:scale-[0.99] dark:bg-court-500/15'
                    : 'bg-white ring-1 ring-court-100 hover:-translate-y-px hover:bg-court-50 hover:ring-court-400 hover:shadow-md active:scale-[0.99] dark:bg-court-900 dark:ring-court-800 dark:hover:bg-court-800'
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

            {selected && !locked && config.format === 'groupsKnockout' ? (
              <GroupOptions config={config} playerCount={playerCount} onChange={onChange} />
            ) : null}
          </div>
        )
      })}
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
