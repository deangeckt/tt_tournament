import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { localeDir, type Locale } from '../../i18n'

/** Whether the app is currently laid out right-to-left. */
function useRtl(): boolean {
  const { i18n } = useTranslation()
  return localeDir(i18n.language as Locale) === 'rtl'
}

/**
 * A score pair, always attached to the right player.
 *
 * `a` belongs to the player named first — the one at the *start* of the row, which
 * in Hebrew is the player on the right. The digits themselves are bidi-isolated so
 * "11–9" is never reordered into "9–11", but isolation alone is not enough: a pair
 * printed a-then-b puts A's number on the left while A's name sits on the right,
 * which reads as the score being given to the wrong player. So in RTL the pair is
 * emitted in visual order too, and the number nearest a name is always that
 * player's.
 *
 * The same holds for a pair that belongs to one player rather than two — a "3:2"
 * games column is won-then-lost, and in RTL the won figure has to be the one on the
 * right, where reading starts. Hence `sep`: the ordering rule is the pair's, not the
 * separator's, so a colon pair gets it for free instead of growing a second
 * component that would sooner or later forget to flip.
 */
export function Score({
  a,
  b,
  sep = '–',
  className = '',
}: {
  a: number
  b: number
  sep?: string
  className?: string
}) {
  const rtl = useRtl()
  const [left, right] = rtl ? [b, a] : [a, b]
  return (
    <span dir="ltr" className={`num tabular-nums ${className}`} style={{ unicodeBidi: 'isolate' }}>
      {left}
      {sep}
      {right}
    </span>
  )
}

/** Any latin/numeric token embedded in translated text. */
export function Ltr({ children }: { children: ReactNode }) {
  return (
    <span dir="ltr" style={{ unicodeBidi: 'isolate' }} className="num">
      {children}
    </span>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle'
  size?: 'md' | 'sm'
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-court-600 text-white hover:bg-court-500 shadow-sm shadow-court-600/25 hover:shadow-md',
  subtle:
    'bg-white text-court-900 ring-1 ring-court-200 hover:bg-court-100 hover:ring-court-400 dark:bg-court-900 dark:text-court-50 dark:ring-court-700 dark:hover:bg-court-800',
  ghost:
    'text-court-700 hover:bg-court-100 hover:text-court-900 dark:text-court-100 dark:hover:bg-court-800 dark:hover:text-white',
  danger: 'bg-red-600 text-white hover:bg-red-500',
}

export function Button({ variant = 'primary', size = 'md', className = '', ...rest }: ButtonProps) {
  const sizing = size === 'sm' ? 'px-3.5 py-2 text-sm min-h-11' : 'px-5 py-3 text-base min-h-12'
  return (
    <button
      {...rest}
      // active:scale gives every press a physical acknowledgement, even when the
      // resulting change is further down the page.
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium
        transition-all duration-150 active:scale-[0.97]
        disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none
        ${sizing} ${VARIANTS[variant]} ${className}`}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-white p-5 ring-1 ring-court-100 dark:bg-court-900 dark:ring-court-800 ${className}`}
    >
      {children}
    </div>
  )
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-3xl font-bold tracking-tight">{children}</h1>
      {sub ? <p className="mt-1.5 text-court-600 dark:text-court-200">{sub}</p> : null}
    </div>
  )
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block font-medium text-court-700 dark:text-court-200">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border-0 bg-white px-4 py-3 text-base ring-1 ring-court-200 ' +
  'transition hover:ring-court-400 placeholder:text-court-400 ' +
  'focus:ring-2 focus:ring-court-500 focus:outline-none ' +
  'dark:bg-court-900 dark:ring-court-700 dark:text-court-50'

/** A pill used for level tabs, group counts and other one-tap choices. */
export function Chip({
  selected,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      {...rest}
      type="button"
      aria-pressed={selected}
      className={`min-h-11 rounded-xl px-4 py-2 font-medium transition-all duration-150 active:scale-[0.97]
        disabled:pointer-events-none disabled:opacity-30 ${
          selected
            ? 'bg-court-600 text-white shadow-sm'
            : 'bg-white text-court-700 ring-1 ring-court-200 hover:ring-court-400 hover:bg-court-50 dark:bg-court-900 dark:text-court-100 dark:ring-court-700 dark:hover:bg-court-800'
        } ${className}`}
    />
  )
}

/** First letters of up to two words — the fallback when a player has no photo. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0] ?? '')
    .join('')
}

const AVATAR_SIZES = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-24 w-24 text-2xl',
} as const

export function Avatar({
  name,
  photo,
  size = 'sm',
  className = '',
}: {
  name: string
  photo?: string
  size?: keyof typeof AVATAR_SIZES
  className?: string
}) {
  const shared = `shrink-0 overflow-hidden rounded-full object-cover ${AVATAR_SIZES[size]} ${className}`
  if (photo) {
    // Decorative: the player's name is always rendered next to it.
    return <img src={photo} alt="" className={shared} />
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center bg-court-100 font-bold text-court-600
        dark:bg-court-800 dark:text-court-200 ${shared}`}
    >
      {initials(name)}
    </span>
  )
}

/** One number with its label — used for player records and tournament summaries. */
export function Stat({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-court-100/70 px-3 py-2.5 text-center dark:bg-court-800/60">
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-court-600 dark:text-court-200">{label}</div>
    </div>
  )
}
