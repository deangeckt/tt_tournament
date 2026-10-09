import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { useOnline } from '../../store/useOnline'
import { toast } from '../../store/useToasts'

/**
 * The one place that says, from any screen, that the device has no connection.
 *
 * Each feature that needs the network already says so where it is used, but a
 * manager running a night from the home-screen app cannot tell from the app itself
 * whether it is connected — and "is this the offline version?" is a fair question
 * about something that opens identically either way. So a slim bar sits under the
 * header for as long as the connection is gone, saying what still works and what
 * waits, and a toast marks its return.
 *
 * It reads `navigator.onLine` through the store, so it inherits the one-way trust
 * documented there: no bar means *some* network, not a working one, and a lookup
 * that cannot get through on a club's dead wifi still says so for itself.
 */
export function OfflineBar() {
  const { t } = useTranslation()
  const online = useOnline((s) => s.online)

  // Driven by the reconnect itself, not by an effect comparing renders.
  useEffect(
    () =>
      useOnline.subscribe((now, before) => {
        if (now.online && !before.online) toast(t('connection.back'), 'info')
      }),
    [t],
  )

  return (
    <AnimatePresence initial={false}>
      {online ? null : (
        <motion.div
          key="offline"
          role="status"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          className="overflow-hidden border-t border-ball-500/20 bg-ball-500/12"
        >
          <p className="mx-auto max-w-3xl px-4 py-1.5 text-sm font-medium text-ball-600">
            <span aria-hidden="true" className="me-1.5">
              📴
            </span>
            {t('connection.offline')}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
