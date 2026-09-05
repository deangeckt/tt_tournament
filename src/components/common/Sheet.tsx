import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'

/** A bottom sheet: scrim, spring slide-up, Escape to close, body scroll locked. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // Stop the page behind from scrolling while the sheet is up.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="no-print fixed inset-0 z-30 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="no-print fixed inset-x-0 bottom-0 z-40 mx-auto max-h-[88vh] max-w-lg overflow-y-auto
              rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-court-900"
            style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="close"
              className="mx-auto mb-4 block h-1.5 w-12 rounded-full bg-court-200 transition hover:bg-court-400 dark:bg-court-700"
            />
            {title ? <h2 className="mb-4 text-xl font-bold">{title}</h2> : null}
            {children}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
