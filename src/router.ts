import { useCallback, useEffect, useState } from 'react'

/**
 * A small hash router.
 *
 * Hash routes matter for GitHub Pages: it serves static files with no rewrite rules,
 * so a path like /t/abc123 would 404 on refresh. Everything after '#' is handled in
 * the browser and never reaches the server — which is also what lets a whole shared
 * tournament ride in the URL without being sent anywhere.
 */
export type Route =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'run'; id: string }
  | { name: 'roster' }
  | { name: 'settings' }
  /** A read-only tournament decoded straight out of the link. */
  | { name: 'view'; payload: string }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0]
  const parts = path.split('/').filter(Boolean)

  if (parts[0] === 'new') return { name: 'new' }
  if (parts[0] === 'roster') return { name: 'roster' }
  if (parts[0] === 'settings') return { name: 'settings' }
  // The share payload is lz-string's URI-safe alphabet, which contains no '/', so
  // the rest of the fragment is one segment and needs no decoding.
  if (parts[0] === 'v' && parts[1]) return { name: 'view', payload: parts.slice(1).join('/') }
  if (parts[0] === 't' && parts[1]) return { name: 'run', id: decodeURIComponent(parts[1]) }
  return { name: 'home' }
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/'
    case 'new':
      return '#/new'
    case 'roster':
      return '#/roster'
    case 'settings':
      return '#/settings'
    case 'view':
      return `#/v/${route.payload}`
    case 'run':
      return `#/t/${encodeURIComponent(route.id)}`
  }
}

export function navigate(route: Route): void {
  window.location.hash = hrefFor(route)
}

const STEP_KEY = 'routeStep'
const OWNER_KEY = 'routeStepOwner'

/** Distinguishes this visit's entries from those a previous visit left behind. */
let visitCounter = 0

/**
 * The step an entry records, or 0 if it is not one of ours: an entry pushed by an
 * earlier visit describes a draft that no longer exists, so it counts as the start.
 */
function readStep(state: unknown, owner: number): number {
  if (typeof state === 'object' && state !== null) {
    const entry = state as Record<string, unknown>
    if (entry[OWNER_KEY] === owner && typeof entry[STEP_KEY] === 'number') {
      return entry[STEP_KEY] as number
    }
  }
  return 0
}

/**
 * A step *within* one route, recorded in the history stack.
 *
 * The wizard is three screens behind a single hash, so without this the phone's back
 * button (or gesture) throws away a half-filled draft instead of stepping back one
 * screen. Each step pushes an entry carrying the same hash: the router never sees a
 * route change, the screen stays mounted with its draft intact, and only
 * `history.state` says which step an entry is. Backing out of step 0 crosses into the
 * previous hash and leaves the route the ordinary way.
 *
 * Going back walks the stack rather than pushing, so entries never pile up and
 * forward still works.
 *
 * Every screen using this starts at step 0, because a fresh mount never has the draft
 * that the steps described: whatever brought us here — a reload, or back from the
 * tournament we just created — brought an empty form, and an inherited number would
 * label it "step 3 of 3". Entries are stamped with the visit that pushed them so that
 * the ones an earlier visit left in the stack read as step 0 too.
 */
export function useRouteStep(): [number, (step: number) => void] {
  const [step, setStep] = useState(0)
  const [owner] = useState(() => ++visitCounter)

  useEffect(() => {
    const onPop = (event: PopStateEvent) => setStep(readStep(event.state, owner))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [owner])

  const goToStep = useCallback(
    (next: number) => {
      const current = readStep(window.history.state, owner)
      if (next === current) return
      // Backwards, the popstate is what moves `step`; setting it here too would show
      // the previous screen before the history stack agreed that we were on it.
      if (next < current) {
        window.history.go(next - current)
        return
      }
      window.history.pushState({ [STEP_KEY]: next, [OWNER_KEY]: owner }, '')
      setStep(next)
    },
    [owner],
  )

  return [step, goToStep]
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
