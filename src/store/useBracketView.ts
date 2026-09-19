import { create } from 'zustand'

/**
 * How the knockout stage is drawn: a list of matches by round, or a tree.
 *
 * A per-device convenience, kept the same way the theme is. The list is the default
 * because it is the one that fits a phone held upright at the table; the tree earns
 * its horizontal scroll on a tablet propped up for the room, and once someone has
 * chosen it there they should not have to choose it again for every level.
 */
export const BRACKET_VIEW_KEY = 'tt.bracketView'

export const BRACKET_VIEWS = ['list', 'tree'] as const
export type BracketView = (typeof BRACKET_VIEWS)[number]

function isView(value: unknown): value is BracketView {
  return BRACKET_VIEWS.includes(value as BracketView)
}

function readStoredView(): BracketView {
  try {
    const value = localStorage.getItem(BRACKET_VIEW_KEY)
    return isView(value) ? value : 'list'
  } catch {
    // Private windows and blocked site data both throw on access.
    return 'list'
  }
}

interface BracketViewState {
  view: BracketView
  setView: (view: BracketView) => void
}

export const useBracketView = create<BracketViewState>((set) => ({
  view: readStoredView(),
  setView(view) {
    set({ view })
    try {
      localStorage.setItem(BRACKET_VIEW_KEY, view)
    } catch {
      // Persisting the preference is a convenience, never a requirement.
    }
  },
}))
