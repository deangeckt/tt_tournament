import { create } from 'zustand'
import { fetchTttmPhoto, fetchTttmPlayer, relayFreeAt, searchTttm } from '../tttm/lookup'
import {
  refreshRanks,
  type RefreshAnswer,
  type RefreshOutcome,
  type RefreshQuestion,
} from '../tttm/refresh'
import { useAppStore } from './useAppStore'
import { isOnline, useOnline } from './useOnline'

/**
 * The one running rank refresh, and whatever it is waiting to be told.
 *
 * A store rather than state on the settings screen because a run outlives the
 * screen that started it: forty players at the relay's twenty a minute is a couple
 * of minutes, and a manager who wanders off to the player list to watch the ranks
 * arrive must still be asked when two of them share a name. So the run lives here,
 * `RankRefreshPrompt` is mounted once in App to put its questions wherever the
 * manager happens to be, and settings only reads the progress.
 */
interface RefreshState {
  status: 'idle' | 'running' | 'done' | 'stopped'
  total: number
  /** Players finished, whatever became of them. */
  done: number
  /** Who is being looked up right now. */
  current?: string
  /** Whether that lookup is queued behind the relay's per-minute allowance. */
  waiting: boolean
  /** The device lost its network; the run is holding its place until it is back. */
  paused: boolean
  question?: RefreshQuestion
  outcomes: RefreshOutcome[]

  /**
   * Begin a run over the whole roster. `onFinish` hears how it ended, from wherever
   * the manager is by then — which is why the confirmation is a callback and not
   * something the settings screen notices on its next render. `onPause` hears the
   * same way when the connection goes. Refuses to begin with no network at all.
   */
  start: (
    onFinish?: (status: 'done' | 'stopped', outcomes: RefreshOutcome[]) => void,
    onPause?: () => void,
  ) => void
  answer: (answer: RefreshAnswer) => void
  stop: () => void
  /** Put the summary away. */
  dismiss: () => void
}

/**
 * Bumped by every start and stop. A run checks it after each wait, so a stopped run
 * still holding a request in flight writes nothing when it lands — and cannot
 * scribble over a newer run's progress either.
 */
let generation = 0
let pending: ((answer: RefreshAnswer) => void) | undefined
/** Releases a run paused for the network: on reconnecting, or on a stop. */
let resume: (() => void) | undefined

function wake() {
  const release = resume
  resume = undefined
  release?.()
}

useOnline.subscribe(({ online }) => {
  if (online) wake()
})

export const useRankRefresh = create<RefreshState>((set, get) => ({
  status: 'idle',
  total: 0,
  done: 0,
  waiting: false,
  paused: false,
  outcomes: [],

  start(onFinish, onPause) {
    if (get().status === 'running' || !isOnline()) return
    const run = ++generation
    const live = () => run === generation
    // Nothing fetched before this moment may answer for it: a refresh that served
    // a page cached an hour ago would be refreshing nothing.
    const freshSince = Date.now()
    const players = [...useAppStore.getState().roster]

    set({
      status: 'running',
      total: players.length,
      done: 0,
      current: undefined,
      waiting: false,
      paused: false,
      question: undefined,
      outcomes: [],
    })

    void refreshRanks(players, {
      byId: (tttmId) => fetchTttmPlayer(String(tttmId), { freshSince }),
      search: (name) => searchTttm(name, { freshSince }),
      ask: (question) =>
        new Promise<RefreshAnswer>((resolve) => {
          pending = resolve
          set({ question })
        }),
      waitForConnection: () =>
        // Asked of navigator directly, the same source the lookup just read: were
        // this the store, a moment where the two disagree would retry and fail in
        // a loop of microtasks that never lets the 'online' event through.
        navigator.onLine
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              resume = () => {
                if (live()) set({ paused: false })
                resolve()
              }
              set({ paused: true })
              onPause?.()
            }),
      async apply(player, match) {
        if (!live()) return
        const { roster, patchRosterPlayer } = useAppStore.getState()
        // Read again rather than trusting the snapshot: the player may have been
        // deleted, or given a photo, while the run was working its way down to them.
        const current = roster.find((p) => p.id === player.id)
        if (!current) return
        await patchRosterPlayer(player.id, { rank: match.rank, tttmId: match.tttmId })
        // The same rule as the card's own lookup: a league picture fills a gap and
        // never replaces one the club chose.
        const photo = match.photo && !current.photo ? await fetchTttmPhoto(match.photo) : undefined
        if (photo && live()) await patchRosterPlayer(player.id, { photo })
      },
      onStart(player, index) {
        if (!live()) return
        set({ current: player.name, done: index, waiting: relayFreeAt() > Date.now() })
      },
      onOutcome(outcome) {
        if (!live()) return
        set((state) => ({ outcomes: [...state.outcomes, outcome], done: state.done + 1 }))
      },
      stopped: () => !live(),
    }).then((result) => {
      if (!live()) return
      set({
        status: result === 'done' ? 'done' : 'stopped',
        current: undefined,
        waiting: false,
        paused: false,
        question: undefined,
      })
      onFinish?.(result, get().outcomes)
    })
  },

  answer(answer) {
    const resolve = pending
    pending = undefined
    set({ question: undefined })
    resolve?.(answer)
  },

  stop() {
    if (get().status !== 'running') return
    generation++
    const resolve = pending
    pending = undefined
    set({
      status: 'stopped',
      current: undefined,
      waiting: false,
      paused: false,
      question: undefined,
    })
    resolve?.({ kind: 'stop' })
    // A run paused for the network is let go too, to find itself stopped and settle.
    wake()
  },

  dismiss() {
    if (get().status === 'running') return
    set({ status: 'idle', total: 0, done: 0, outcomes: [] })
  },
}))
