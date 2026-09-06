import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { importFile, stashImportSummary } from '../../store/backup'
import { Button } from '../common/ui'
import { toast } from '../../store/useToasts'
import { navigate } from '../../router'

/**
 * What an empty device is offered instead of an empty list.
 *
 * A club's players are not new every season, and the manager arriving on a fresh
 * phone, a reinstalled browser or a laptop that has never run this has all of them
 * already — in a backup file, one tap away. Left to itself the empty state suggests
 * typing twenty names back in, which is the wrong first move and the one a person
 * will only discover was wrong after doing it.
 *
 * A card rather than a dialogue on purpose. A modal on first load would land on
 * someone who has never used the app and has nothing to import, and on the crawler
 * that renders this screen every time — see the note on the home empty state. This
 * asks loudly and costs nothing to ignore.
 */
export function ImportPrompt({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const choose = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    // Merge, always: there is nothing here to replace, and 'replace' is a destructive
    // mode that has no business being the default on a screen whose whole premise is
    // that the device is empty. The full choice stays in settings.
    const imported = await importFile(file, 'merge')
    if (!imported) {
      setBusy(false)
      toast(t('settings.importFailed'), 'warn')
      return
    }
    // Same reload as the settings screen's import, for the same reason: every screen
    // holding a record has just had it rewritten underneath. The confirmation is
    // parked in sessionStorage and picked up on the way back up, wherever that lands.
    stashImportSummary(imported)
    window.location.reload()
  }

  return (
    <div
      className={`print-keep rounded-2xl border-2 border-dashed border-court-300 bg-white/70 p-6
        text-center dark:border-court-700 dark:bg-court-900/70 ${className}`}
    >
      <div aria-hidden="true" className="text-4xl">
        📥
      </div>
      <h2 className="mt-2 text-xl font-bold">{t('restore.title')}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-court-600 dark:text-court-200">
        {t('restore.body')}
      </p>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          void choose(e.target.files?.[0])
          // Cleared so choosing the same file twice still fires a change.
          e.target.value = ''
        }}
      />

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Button
          className="text-lg"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          ⬆ {busy ? t('restore.working') : t('restore.action')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate({ name: 'settings' })}>
          {t('restore.more')}
        </Button>
      </div>

      <p className="mt-3 text-sm text-court-500 dark:text-court-300">{t('restore.otherwise')}</p>
    </div>
  )
}
