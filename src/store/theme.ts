/**
 * Light/dark theming.
 *
 * Two values, deliberately kept apart: the *preference* ('system' | 'light' | 'dark')
 * is what the user chose and what is stored; the *resolved* theme ('light' | 'dark')
 * is what is painted. Only the resolved value ever reaches CSS, stamped on
 * `<html data-theme>`, so every stylesheet rule and every Tailwind `dark:` variant has
 * exactly one thing to look at rather than a media query *and* an attribute.
 *
 * The same attribute is set by an inline script in index.html before the bundle
 * loads. Without it the page paints in the wrong theme for a frame on every load —
 * the same flash the `dir` script exists to prevent.
 */

export const THEME_KEY = 'tt.theme'

export const THEMES = ['system', 'light', 'dark'] as const
export type ThemePref = (typeof THEMES)[number]
export type ResolvedTheme = 'light' | 'dark'

function isPref(value: unknown): value is ThemePref {
  return THEMES.includes(value as ThemePref)
}

export function readStoredTheme(): ThemePref | null {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return isPref(value) ? value : null
  } catch {
    // Private windows and blocked site data both throw on access.
    return null
  }
}

/**
 * Unlike the language, following the system here is right: a phone in night mode is
 * an explicit statement about *this* screen, not a guess about who the user is.
 */
export function detectTheme(): ThemePref {
  return readStoredTheme() ?? 'system'
}

function systemQuery(): MediaQueryList | null {
  return typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null
}

export function resolveTheme(pref: ThemePref): ResolvedTheme {
  if (pref !== 'system') return pref
  return systemQuery()?.matches ? 'dark' : 'light'
}

export function applyTheme(pref: ThemePref): ResolvedTheme {
  const resolved = resolveTheme(pref)
  const root = document.documentElement
  root.dataset.theme = resolved
  // Native controls — the file picker, scrollbars, the date field — are painted by
  // the browser and read this, not our classes.
  root.style.colorScheme = resolved
  // The phone's browser chrome sits directly above the page; leaving it at one fixed
  // colour puts a dark bar over a light app, or the reverse.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0d1526' : '#eef2fb')
  try {
    localStorage.setItem(THEME_KEY, pref)
  } catch {
    // Persisting the preference is a convenience, never a requirement.
  }
  return resolved
}

/**
 * Repaint when the OS flips — a phone entering night mode, a laptop at sunset — but
 * only while the user is actually following it. Returns an unsubscribe function.
 */
export function watchSystemTheme(
  getPref: () => ThemePref,
  onResolved: (resolved: ResolvedTheme) => void,
): () => void {
  const query = systemQuery()
  if (!query) return () => {}
  const onChange = () => {
    if (getPref() === 'system') onResolved(applyTheme('system'))
  }
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
