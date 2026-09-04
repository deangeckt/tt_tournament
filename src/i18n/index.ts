import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { en } from './en'
import { he } from './he'

export type Locale = 'he' | 'en'

export const LOCALE_KEY = 'tt.locale'

export function localeDir(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'he' ? 'rtl' : 'ltr'
}

export function readStoredLocale(): Locale | null {
  try {
    const value = localStorage.getItem(LOCALE_KEY)
    return value === 'he' || value === 'en' ? value : null
  } catch {
    // Private windows and blocked site data both throw on access.
    return null
  }
}

/** Hebrew-first: only an explicit English preference or an English browser wins. */
export function detectLocale(): Locale {
  const stored = readStoredLocale()
  if (stored) return stored
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'he'
}

export function applyLocale(locale: Locale): void {
  document.documentElement.lang = locale
  document.documentElement.dir = localeDir(locale)
  try {
    localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    // Persisting the preference is a convenience, never a requirement.
  }
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    he: { translation: he },
  },
  lng: detectLocale(),
  fallbackLng: 'he',
  interpolation: { escapeValue: false },
})

export default i18n

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof en }
    defaultNS: 'translation'
  }
}
