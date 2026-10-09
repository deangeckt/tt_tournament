import { create } from 'zustand'

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'success' | 'warn'
  /** Optional single action, e.g. undo. */
  action?: { label: string; run: () => void }
  /**
   * Stays until it is answered or closed, and never counts toward the three on screen.
   * For a decision that can wait — a new version to reload into — never for a
   * confirmation: a confirmation that does not go away is a banner nobody reads.
   */
  persistent?: boolean
}

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>) => number
  dismiss: (id: number) => void
}

let nextId = 1

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push(toast) {
    const id = nextId++
    // Keep at most three passing toasts on screen; older ones drop off the end. A
    // persistent one is exempt, or three quick scores would push it off unanswered.
    let room = 3
    set((state) => ({
      toasts: [{ ...toast, id }, ...state.toasts].filter((t) => t.persistent || room-- > 0),
    }))
    return id
  },
  dismiss(id) {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))

/** Confirm that something happened, optionally offering one way to take it back. */
export function toast(text: string, tone: Toast['tone'] = 'success', action?: Toast['action']) {
  return useToasts.getState().push({ text, tone, action })
}
