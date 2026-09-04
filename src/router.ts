import { useEffect, useState } from 'react'

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

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
