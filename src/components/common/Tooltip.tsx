import { useId, useState, type ReactNode } from 'react'

/**
 * A hover/focus tooltip for desktop.
 *
 * Deliberately *not* backed by the native `title` attribute. Using both meant the
 * same control could show the styled bubble, the browser's own black box a second
 * later, or — where a parent had its own `title` — something else entirely. Which
 * one appeared depended on how long the pointer rested, so the same X button looked
 * like three different controls. One bubble, always.
 *
 * The label stays in the accessibility tree whether or not the bubble is up: it is
 * rendered into a visually hidden node that the trigger points at with
 * `aria-describedby`, so screen readers get it without waiting for a hover that will
 * never happen.
 */
export function Tooltip({
  label,
  children,
  side = 'top',
}: {
  label: string
  children: ReactNode
  side?: 'top' | 'bottom'
}) {
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <span
      className="relative inline-flex"
      // The handlers sit on the wrapper rather than the child so a disabled control
      // — which Tailwind gives `pointer-events: none` — still explains itself.
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={id} className="inline-flex">
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        className={
          open
            ? `pointer-events-none absolute start-1/2 z-50 w-max max-w-60 -translate-x-1/2 rounded-lg
               bg-court-950 px-2.5 py-1.5 text-xs leading-snug font-medium text-white shadow-lg
               rtl:translate-x-1/2 dark:bg-court-100 dark:text-court-950 ${
                 side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
               }`
            : // Off-screen rather than display:none, so the description is still
              // announced when the control itself takes focus.
              'pointer-events-none absolute h-px w-px overflow-hidden opacity-0'
        }
      >
        {label}
      </span>
    </span>
  )
}
