import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { en } from './en'
import { isLocale, LOCALES, TRANSLATIONS, type Locale } from './locales'

export { LOCALES, LOCALE_NAMES, type Locale } from './locales'

export const LOCALE_KEY = 'tt.locale'

export function localeDir(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'he' ? 'rtl' : 'ltr'
}

export function readStoredLocale(): Locale | null {
  try {
    const value = localStorage.getItem(LOCALE_KEY)
    return isLocale(value) ? value : null
  } catch {
    // Private windows and blocked site data both throw on access.
    return null
  }
}

/**
 * Hebrew unless the user has explicitly switched to another language.
 *
 * Deliberately not derived from navigator.language: this is a Hebrew app for Israeli
 * clubs, and plenty of people there run their browser in English. Guessing from the
 * browser would show them the wrong language by default.
 */
export function detectLocale(): Locale {
  return readStoredLocale() ?? 'he'
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
  resources: Object.fromEntries(
    LOCALES.map((locale) => [locale, { translation: TRANSLATIONS[locale] }]),
  ),
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
