import { useId, useState, type ReactNode } from 'react'

/**
 * A hover/focus tooltip for desktop.
 *
 * Uses the native `title` as well as the styled bubble: `title` is what a user gets
 * if they hover before React hydrates, and it is what screen readers already know how
 * to announce. The bubble exists because `title` takes about a second to appear and
 * cannot be styled.
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
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} title={label} className="inline-flex">
        {children}
      </span>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className={`pointer-events-none absolute start-1/2 z-50 w-max max-w-60 -translate-x-1/2 rounded-lg
            bg-court-950 px-2.5 py-1.5 text-xs leading-snug font-medium text-white shadow-lg
            rtl:translate-x-1/2 dark:bg-court-100 dark:text-court-950 ${
              side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            }`}
        >
          {label}
        </span>
      ) : null}
    </span>
  )
}
