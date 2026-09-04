import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useToasts, type Toast } from '../../store/useToasts'

const TONES: Record<Toast['tone'], string> = {
  info: 'bg-court-900 text-white dark:bg-court-100 dark:text-court-950',
  success: 'bg-court-700 text-white',
  warn: 'bg-ball-600 text-white',
}

function ToastRow({ toast: item }: { toast: Toast }) {
  const dismiss = useToasts((s) => s.dismiss)

  useEffect(() => {
    // Actionable toasts stay longer, since they ask the user to decide something.
    const ms = item.action ? 6000 : 2600
    const timer = setTimeout(() => dismiss(item.id), ms)
    return () => clearTimeout(timer)
  }, [item.id, item.action, dismiss])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className={`pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 font-medium shadow-lg ${TONES[item.tone]}`}
    >
      <span>{item.text}</span>
      {item.action ? (
        <button
          type="button"
          className="shrink-0 rounded-lg px-2 py-1 underline underline-offset-2 transition hover:bg-white/20"
          onClick={() => {
            item.action?.run()
            dismiss(item.id)
          }}
        >
          {item.action.label}
        </button>
      ) : null}
    </motion.div>
  )
}

export function ToastHost() {
  const toasts = useToasts((s) => s.toasts)
  return (
    <div
      aria-live="polite"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      className="no-print pointer-events-none fixed inset-x-0 z-50 mx-auto flex max-w-md flex-col items-center gap-2 px-4"
    >
      <AnimatePresence initial={false}>
        {toasts.map((item) => (
          <ToastRow key={item.id} toast={item} />
        ))}
      </AnimatePresence>
    </div>
  )
}
