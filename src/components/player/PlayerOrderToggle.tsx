import { useTranslation } from 'react-i18next'
import { PLAYER_ORDERS, usePlayerOrder, type PlayerOrder } from '../../store/usePlayerOrder'
import { Segmented } from '../common/ui'

const LABEL: Record<PlayerOrder, 'roster.orderRank' | 'roster.orderName'> = {
  rank: 'roster.orderRank',
  name: 'roster.orderName',
}

/**
 * Strongest first, or alphabetically — the same switch above every list of saved
 * players, and one shared preference behind all of them.
 *
 * Per device rather than per screen: someone who thinks of the club by strength
 * thinks of it that way in the roster and in the wizard both, and being asked twice
 * would only make the two lists disagree.
 */
export function PlayerOrderToggle() {
  const { t } = useTranslation()
  const order = usePlayerOrder((s) => s.order)
  const setOrder = usePlayerOrder((s) => s.setOrder)

  return (
    <Segmented
      value={order}
      onChange={setOrder}
      label={t('roster.orderLabel')}
      options={PLAYER_ORDERS.map((option) => ({ value: option, label: t(LABEL[option]) }))}
    />
  )
}
