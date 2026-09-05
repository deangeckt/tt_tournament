import { useId, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

/**
 * A hover/focus tooltip for desktop.
 *
 * Deliberately *not* backed by the native `title` attribute. Using both meant the
 * same control could show the styled bubble, the browser's own black box a second
 * later, or — where a parent had its own `title` — something else entirely. Which
 * one appeared depended on how long the pointer rested, so the same X button looked
 * like three different controls. One bubble, always.
 *
 * Hover here means a real pointer. A touch device synthesises `mouseenter` on the
 * first tap, and a control that changes the DOM from that handler has the click that
 * would have followed swallowed by the browser — so the bubble appeared and the button
 * did nothing until tapped a second time. Pointer events carry the device that caused
 * them, so the bubble simply never opens for touch. Focus is gated the same way, on
 * `:focus-visible`, so a tap that leaves a button focused does not raise it either.
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
      onPointerEnter={(e: ReactPointerEvent) => {
        if (e.pointerType === 'mouse') setOpen(true)
      }}
      onPointerLeave={() => setOpen(false)}
      // A press dismisses the bubble rather than leaving it hanging over whatever the
      // click just opened.
      onPointerDown={() => setOpen(false)}
      onFocus={(e) => {
        if (e.target instanceof Element && e.target.matches(':focus-visible')) setOpen(true)
      }}
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
