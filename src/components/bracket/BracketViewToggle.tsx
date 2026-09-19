import { useTranslation } from 'react-i18next'
import { BRACKET_VIEWS, useBracketView, type BracketView } from '../../store/useBracketView'

const LABEL: Record<BracketView, 'run.viewList' | 'run.viewTree'> = {
  list: 'run.viewList',
  tree: 'run.viewTree',
}

/**
 * List or tree, as a two-way switch beside the knockout heading.
 *
 * Sits next to the section it changes rather than up in the page chrome, so it is
 * only there when there is a knockout to draw — a round robin has no tree, and a
 * control that switches between two identical screens teaches people to ignore it.
 */
export function BracketViewToggle() {
  const { t } = useTranslation()
  const view = useBracketView((s) => s.view)
  const setView = useBracketView((s) => s.setView)

  return (
    <div
      role="group"
      aria-label={t('run.viewLabel')}
      className="no-print inline-flex rounded-xl bg-court-100 p-1 dark:bg-court-800"
    >
      {BRACKET_VIEWS.map((option) => {
        const selected = option === view
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => setView(option)}
            className={`min-h-11 rounded-lg px-3.5 text-sm font-medium transition-all duration-150 active:scale-[0.97] ${
              selected
                ? 'bg-white text-court-900 shadow-sm dark:bg-court-900 dark:text-court-50'
                : 'text-court-600 hover:text-court-900 dark:text-court-200 dark:hover:text-white'
            }`}
          >
            {t(LABEL[option])}
          </button>
        )
      })}
    </div>
  )
}
