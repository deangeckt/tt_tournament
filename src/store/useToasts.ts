import { create } from 'zustand'

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'success' | 'warn'
  /** Optional single action, e.g. undo. */
  action?: { label: string; run: () => void }
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
    // Keep at most three on screen; older ones drop off the end.
    set((state) => ({ toasts: [{ ...toast, id }, ...state.toasts].slice(0, 3) }))
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
