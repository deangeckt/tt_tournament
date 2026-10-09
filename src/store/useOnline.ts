import { create } from 'zustand'

/**
 * Whether the device has a network at all.
 *
 * Trust it only when it says no. `navigator.onLine` false really does mean there is
 * no network, but true only means there is *some*: a club's wifi with nothing behind
 * it reads as online. So offline is a reason not to try, and online is only leave to
 * — every request still has its own failure path, and nothing here replaces one.
 *
 * The engine-side code that talks to the network (`tttm/lookup.ts`) reads
 * `navigator.onLine` itself rather than importing this, because it runs under the
 * plain node test environment, where there is no window to listen on.
 */
export const useOnline = create<{ online: boolean }>(() => ({ online: navigator.onLine }))

window.addEventListener('online', () => useOnline.setState({ online: true }))
window.addEventListener('offline', () => useOnline.setState({ online: false }))

export function isOnline(): boolean {
  return useOnline.getState().online
}
