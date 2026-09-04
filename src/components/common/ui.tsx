import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Scores, seeds and any digit pair must render left-to-right even inside Hebrew
 * text. Without isolation the bidi algorithm can reorder "11-9" into "9-11", which
 * looks exactly like a wrong score rather than a layout bug.
 */
export function Score({ a, b, className = '' }: { a: number; b: number; className?: string }) {
  return (
    <span dir="ltr" className={`num tabular-nums ${className}`} style={{ unicodeBidi: 'isolate' }}>
      {a}–{b}
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
