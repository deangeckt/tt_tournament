import { create } from 'zustand'
import i18n from '../i18n'
import { requestPersistence } from './db'
import { toast } from './useToasts'

/**
 * How this browser can put the app on the home screen, for the card on settings.
 *
 * - `standalone`: it already is the installed app, so there is nothing to offer.
 * - `prompt`: Chromium has offered to install, and the offer is held for the button.
 * - `ios`: Safari, which has no install API — only Share, then Add to Home Screen.
 * - `installed`: installed from this tab just now; this tab is still the browser.
 * - `none`: no way in from here, or already installed (Chromium stops offering then).
 *
 * Imported for its side effects from main.tsx, not on first use: `beforeinstallprompt`
 * can fire long before anyone opens settings, and an event nobody was listening for
 * is gone for the rest of the page.
 */
export type InstallWay = 'standalone' | 'prompt' | 'ios' | 'installed' | 'none'

/** Not in the DOM typings: Chromium only. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function standalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** iPadOS reports itself as a Mac; the touch screen is what gives it away. */
function ios(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

let deferred: BeforeInstallPromptEvent | null = null

export const useInstall = create<{ way: InstallWay }>(() => ({
  way: standalone() ? 'standalone' : ios() ? 'ios' : 'none',
}))

window.addEventListener('beforeinstallprompt', (event) => {
  // Without this Chrome shows its own install bar, over whatever the manager is in
  // the middle of. The offer waits on the settings screen instead.
  event.preventDefault()
  deferred = event as BeforeInstallPromptEvent
  useInstall.setState({ way: 'prompt' })
})

window.addEventListener('appinstalled', () => {
  deferred = null
  useInstall.setState({ way: 'installed' })
  // Far likelier to be granted now than it was on the first visit.
  void requestPersistence()
  toast(i18n.t('install.done'))
})

/** Show the browser's own install dialog. An offer can be used once. */
export async function install(): Promise<void> {
  const event = deferred
  if (!event) return
  deferred = null
  await event.prompt()
  const { outcome } = await event.userChoice
  // Declined: Chromium may offer again later, through a fresh event.
  if (outcome === 'dismissed') useInstall.setState({ way: 'none' })
}
