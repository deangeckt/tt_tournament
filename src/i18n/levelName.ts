import type { TFunction } from 'i18next'

/**
 * Default name of the nth level, in the language the app is currently in.
 *
 * A bare letter reads as a list marker rather than a name, so the word that makes it
 * a division comes from the translation — and so do the letters, since a Hebrew score
 * sheet numbers its divisions א׳, ב׳, ג׳ and an English one A, B, C. Beyond the
 * letters a language supplies, it falls back to the number.
 *
 * Only a default: the name is stored with the level and editable from the moment it
 * is created, so switching language later leaves existing names alone.
 */
export function levelDefaultName(index: number, t: TFunction): string {
  const letter = t('wizard.levelLetters').split(',')[index]?.trim()
  return t('wizard.levelDefault', { letter: letter || index + 1 })
}
