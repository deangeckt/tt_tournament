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
    'bg-court-600 text-white hover:bg-court-700 active:bg-court-700 shadow-sm shadow-court-600/25',
  subtle:
    'bg-white text-court-900 ring-1 ring-court-200 hover:bg-court-50 dark:bg-court-900 dark:text-court-50 dark:ring-court-700 dark:hover:bg-court-800',
  ghost: 'text-court-700 hover:bg-court-100 dark:text-court-100 dark:hover:bg-court-800',
  danger: 'bg-red-600 text-white hover:bg-red-700',
}

export function Button({ variant = 'primary', size = 'md', className = '', ...rest }: ButtonProps) {
  const sizing = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 min-h-11'
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court-500
        disabled:cursor-not-allowed disabled:opacity-40 ${sizing} ${VARIANTS[variant]} ${className}`}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-white p-4 ring-1 ring-court-100 dark:bg-court-900 dark:ring-court-800 ${className}`}
    >
      {children}
    </div>
  )
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
      {sub ? <p className="mt-1 text-sm text-court-600 dark:text-court-200">{sub}</p> : null}
    </div>
  )
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-court-700 dark:text-court-200">
        {label}
      </span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border-0 bg-white px-3 py-2.5 text-base ring-1 ring-court-200 ' +
  'placeholder:text-court-400 focus:ring-2 focus:ring-court-500 focus:outline-none ' +
  'dark:bg-court-900 dark:ring-court-700 dark:text-court-50'
