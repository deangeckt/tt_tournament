import { create } from 'zustand'
import type { Player } from '../engine/types'

/**
 * How a list of saved players is ordered: strongest first, or alphabetically.
 *
 * A per-device convenience kept the same way the theme and the bracket view are.
 * Rank is the default because that is the order the evening is actually built in —
 * a manager composing levels is looking for the top eight, not for the letter ג —
 * and it is the order the banded draw will put them in anyway. Alphabetical stays
 * one tap away for the other job this list does: finding one named person.
 */
export const PLAYER_ORDER_KEY = 'tt.playerOrder'

export const PLAYER_ORDERS = ['rank', 'name'] as const
export type PlayerOrder = (typeof PLAYER_ORDERS)[number]

function isOrder(value: unknown): value is PlayerOrder {
  return PLAYER_ORDERS.includes(value as PlayerOrder)
}

function readStoredOrder(): PlayerOrder {
  try {
    const value = localStorage.getItem(PLAYER_ORDER_KEY)
    return isOrder(value) ? value : 'rank'
  } catch {
    // Private windows and blocked site data both throw on access.
    return 'rank'
  }
}

interface PlayerOrderState {
  order: PlayerOrder
  setOrder: (order: PlayerOrder) => void
}

export const usePlayerOrder = create<PlayerOrderState>((set) => ({
  order: readStoredOrder(),
  setOrder(order) {
    set({ order })
    try {
      localStorage.setItem(PLAYER_ORDER_KEY, order)
    } catch {
      // Persisting the preference is a convenience, never a requirement.
    }
  },
}))

/**
 * Sort players for display. Never mutates the input.
 *
 * The roster arrives from the database already collated by name — Hebrew needs a
 * locale-aware collator, and doing it once at the source is why every screen can
 * treat `name` order as "leave it alone". Rank order is therefore a *stable* sort
 * on top of that, which is what puts equally ranked players, and the whole unranked
 * tail, in alphabetical order for free.
 *
 * Unranked players go last rather than at zero: absent is not 0.0, and a player who
 * has a ranking and has not scored on it yet belongs above someone with no ranking
 * at all.
 */
export function orderPlayers<T extends Pick<Player, 'rank'>>(
  players: readonly T[],
  order: PlayerOrder,
): T[] {
  if (order === 'name') return [...players]
  return [...players].sort((a, b) => {
    // Not `(a.rank ?? -Infinity) - ...`: two unranked players would subtract
    // -Infinity from -Infinity and compare NaN, which sorts unpredictably.
    if (a.rank === undefined) return b.rank === undefined ? 0 : 1
    if (b.rank === undefined) return -1
    return b.rank - a.rank
  })
}
