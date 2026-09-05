import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

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
 * The bubble is **portalled to the body and positioned from the trigger's viewport
 * rect**, not absolutely positioned inside the trigger. Rounded lists clip their rows
 * with `overflow-hidden`, so an in-flow bubble on the last row's X was cut off at the
 * list's edge — a tooltip is worth nothing if the container decides how much of it you
 * see, and z-index cannot lift a box out of an ancestor's overflow. Being fixed, it
 * cannot follow a scroll, so a scroll dismisses it. It is also shifted back inside the
 * viewport when centring would push it off an edge.
 *
 * The label stays in the accessibility tree whether or not the bubble is up: it is
 * rendered into a visually hidden node that the trigger points at with
 * `aria-describedby`, so screen readers get it without waiting for a hover that will
 * never happen. The portalled bubble is that node's twin, hidden from the tree, so the
 * description has one home no matter where the pixels land.
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
  const [at, setAt] = useState<DOMRect | null>(null)
  const [shift, setShift] = useState(0)
  const trigger = useRef<HTMLSpanElement>(null)
  const bubble = useRef<HTMLSpanElement>(null)
  const id = useId()
  const open = at !== null

  const show = () => {
    const el = trigger.current
    if (!el) return
    setShift(0)
    setAt(el.getBoundingClientRect())
  }
  const hide = () => setAt(null)

  // Centring on the trigger puts a wide bubble off the edge next to a control near
  // one; nudge it back before it is painted. Keyed to the open, so the correction it
  // applies is never measured a second time and compounded.
  useLayoutEffect(() => {
    const el = bubble.current
    if (!at || !el) return
    const box = el.getBoundingClientRect()
    const margin = 8
    if (box.right > window.innerWidth - margin) setShift(window.innerWidth - margin - box.right)
    else if (box.left < margin) setShift(margin - box.left)
  }, [at])

  // A fixed bubble cannot follow the row it belongs to, so anything that moves the
  // row takes the bubble down rather than leaving it pointing at nothing.
  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [open])

  return (
    <span
      ref={trigger}
      className="relative inline-flex"
      // The handlers sit on the wrapper rather than the child so a disabled control
      // — which Tailwind gives `pointer-events: none` — still explains itself.
      onPointerEnter={(e: ReactPointerEvent) => {
        if (e.pointerType === 'mouse') show()
      }}
      onPointerLeave={hide}
      // A press dismisses the bubble rather than leaving it hanging over whatever the
      // click just opened.
      onPointerDown={hide}
      onFocus={(e) => {
        if (e.target instanceof Element && e.target.matches(':focus-visible')) show()
      }}
      onBlur={hide}
    >
      <span aria-describedby={id} className="inline-flex">
        {children}
      </span>
      {/* Off-screen rather than display:none, so the description is still announced
          when the control itself takes focus. */}
      <span id={id} role="tooltip" className="absolute h-px w-px overflow-hidden opacity-0">
        {label}
      </span>
      {at
        ? createPortal(
            <span
              ref={bubble}
              aria-hidden="true"
              style={{
                position: 'fixed',
                left: at.left + at.width / 2 + shift,
                top: side === 'top' ? at.top - 6 : at.bottom + 6,
                transform: `translate(-50%, ${side === 'top' ? '-100%' : '0'})`,
              }}
              className="pointer-events-none z-50 w-max max-w-60 rounded-lg bg-court-950 px-2.5 py-1.5
                         text-xs leading-snug font-medium text-white shadow-lg dark:bg-court-100
                         dark:text-court-950"
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  )
}
