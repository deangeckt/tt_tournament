import { en } from './en'
import { he } from './he'
import { ru } from './ru'

/**
 * Every language the app speaks, in the order the settings screen offers them.
 *
 * Listing one here registers it with i18next, with the stored-preference check and
 * with the language switch. The one copy this cannot reach is the inline script in
 * index.html, which runs before any module loads and keeps its own list.
 */
export const TRANSLATIONS = { he, en, ru }

export type Locale = keyof typeof TRANSLATIONS

export const LOCALES = Object.keys(TRANSLATIONS) as Locale[]

/** What each language calls itself, which is the only label a language switch can use. */
export const LOCALE_NAMES: Record<Locale, string> = {
  he: 'עברית',
  en: 'English',
  ru: 'Русский',
}

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale)
}
