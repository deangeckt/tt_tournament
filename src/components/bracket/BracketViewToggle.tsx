import { useTranslation } from 'react-i18next'
import { BRACKET_VIEWS, useBracketView, type BracketView } from '../../store/useBracketView'
import { Segmented } from '../common/ui'

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
    <Segmented
      value={view}
      onChange={setView}
      label={t('run.viewLabel')}
      options={BRACKET_VIEWS.map((option) => ({ value: option, label: t(LABEL[option]) }))}
    />
  )
}
