import { create } from 'zustand'

/**
 * How the knockout stage is drawn: a tree, or a list of matches by round.
 *
 * A per-device convenience, kept the same way the theme is. The tree is the default
 * because it is the picture of the night everyone at the club already has in their
 * head, and it costs nothing on a phone: it never scrolls, it measures its frame and
 * scales the drawing to fit. The list stays one tap away for working through a round
 * a card at a time, and once someone has chosen it there they should not have to
 * choose it again for every level.
 */
export const BRACKET_VIEW_KEY = 'tt.bracketView'

export const BRACKET_VIEWS = ['tree', 'list'] as const
export type BracketView = (typeof BRACKET_VIEWS)[number]

function isView(value: unknown): value is BracketView {
  return BRACKET_VIEWS.includes(value as BracketView)
}

function readStoredView(): BracketView {
  try {
    const value = localStorage.getItem(BRACKET_VIEW_KEY)
    return isView(value) ? value : 'tree'
  } catch {
    // Private windows and blocked site data both throw on access.
    return 'tree'
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
