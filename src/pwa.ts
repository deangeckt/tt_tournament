import { registerSW } from 'virtual:pwa-register'
import i18n from './i18n'
import { toast, useToasts } from './store/useToasts'

/**
 * The service worker: what lets the app open in a hall with no signal.
 *
 * A new build is never swapped in by itself. It waits behind a toast until the
 * manager taps Reload, because an automatic reload would land in the middle of a
 * half-typed score. Closing the toast is safe too: the waiting worker takes over
 * once every window of the app has closed, and the next load asks again.
 */

/** Never more often than this, however often the tab is brought back. */
const MIN_CHECK_GAP_MS = 10 * 60 * 1000
const CHECK_EVERY_MS = 60 * 60 * 1000

export function registerServiceWorker(): void {
  let updateToast: number | null = null

  const updateSW = registerSW({
    onNeedRefresh() {
      if (updateToast !== null && useToasts.getState().toasts.some((t) => t.id === updateToast)) {
        return
      }
      updateToast = useToasts.getState().push({
        text: i18n.t('pwa.updateReady'),
        tone: 'info',
        persistent: true,
        action: { label: i18n.t('pwa.reload'), run: () => void updateSW(true) },
      })
    },
    onOfflineReady() {
      toast(i18n.t('pwa.offlineReady'), 'info')
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // A browser looks for a new worker when the page navigates, and with hash
      // routing it never does; an installed app can stay open for days. So the app
      // asks for itself — hourly, and whenever it is brought back to the screen.
      let lastCheck = Date.now()
      const check = () => {
        if (!navigator.onLine || registration.installing) return
        if (Date.now() - lastCheck < MIN_CHECK_GAP_MS) return
        lastCheck = Date.now()
        registration.update().catch(() => {
          // Offline after all, or the host is down: the next check will do.
        })
      }
      setInterval(check, CHECK_EVERY_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.addEventListener('online', check)
    },
  })
}
