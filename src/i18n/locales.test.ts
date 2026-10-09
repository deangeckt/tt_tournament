import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'
import { en } from './en'
import { LOCALES, TRANSLATIONS } from './locales'

type Tree = { readonly [key: string]: string | Tree }

/** Every key in a resource tree, flattened to `home.players_one`. */
function flatten(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value]] : flatten(value, `${prefix}${key}.`),
  )
}

const PLURAL = /_(zero|one|two|few|many|other)$/

const pluralFamilies = [
  ...new Set(
    flatten(en)
      .map(([key]) => key)
      .filter((key) => PLURAL.test(key))
      .map((key) => key.replace(PLURAL, '')),
  ),
]

describe('translations', () => {
  // The type demands the categories each file declares; this checks the declaration
  // against the categories Intl actually selects, which is what i18next asks for.
  it.each(LOCALES)('%s has every plural form its language selects', (locale) => {
    const keys = new Set(flatten(TRANSLATIONS[locale]).map(([key]) => key))
    const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories
    const missing = pluralFamilies
      .flatMap((family) => categories.map((category) => `${family}_${category}`))
      .filter((key) => !keys.has(key))
    expect(missing).toEqual([])
  })

  // "שחקן אחד" is right for Hebrew's `_one`, which only 1 selects. Russian's `_one`
  // is also 21 and 31, so a form that spells the number out says 21 is one player.
  it.each(LOCALES)('%s prints the count in any form more than one number selects', (locale) => {
    const rules = new Intl.PluralRules(locale)
    const shared = new Set(
      Array.from({ length: 200 }, (_, n) => rules.select(n)).filter(
        (category, i, all) => all.indexOf(category) !== i,
      ),
    )
    const silent = flatten(TRANSLATIONS[locale])
      .filter(([key]) => shared.has(key.match(PLURAL)?.[1] as Intl.LDMLPluralRule))
      .filter(([, text]) => !text.includes('{{count}}'))
      .map(([key]) => key)
    expect(silent).toEqual([])
  })

  it.each(LOCALES)('%s is accepted by the script that sets the direction before load', (locale) => {
    expect(indexHtml).toContain(`l !== '${locale}'`)
  })
})
