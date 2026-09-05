import { create } from 'zustand'
import {
  applyTheme,
  detectTheme,
  resolveTheme,
  watchSystemTheme,
  type ResolvedTheme,
  type ThemePref,
} from './theme'

interface ThemeState {
  pref: ThemePref
  /** What is actually painted right now — 'system' has already been resolved. */
  resolved: ResolvedTheme
  setPref: (pref: ThemePref) => void
}

const initial = detectTheme()

export const useTheme = create<ThemeState>((set) => ({
  pref: initial,
  resolved: resolveTheme(initial),
  setPref(pref) {
    set({ pref, resolved: applyTheme(pref) })
  },
}))

watchSystemTheme(
  () => useTheme.getState().pref,
  (resolved) => useTheme.setState({ resolved }),
)
