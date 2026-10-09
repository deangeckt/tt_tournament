import type { Player } from '../engine/types'
import type { TttmResult } from './lookup'
import { nameKey, rankMatches, type TttmPlayer } from './parse'

/**
 * Refreshing every saved player's rank in one pass.
 *
 * TTTM revises its points every week, and a club's roster is thirty or forty names,
 * so opening each card to look somebody up again is the job this exists to save.
 * It always fetches: a rank already on the record is exactly the one that may have
 * moved since.
 *
 * The run decides most players on its own and stops only where a person has to.
 * Somebody already linked to TTTM — the manager picked them once, so their id is on
 * the record — is read straight off their own page, and no amount of namesakes can
 * confuse that. Everyone else is searched by name, and a search that finds exactly
 * one player of exactly that name is taken. Two people really do share a name, so
 * two exact matches is a question, never a guess; and a near spelling is a question
 * too, because "דני כהן" may well be TTTM's "דניאל כהן" and may just as well not be.
 * Whatever is picked is linked by id, which is what makes the next refresh of that
 * player silent.
 *
 * Losing the connection is not a question. Asked "try again?" per player, a manager
 * whose wifi dropped would answer it forty times; and no answer but waiting can help.
 * So the run waits — on the same player, asking nobody — and carries on when the
 * network is back. `RefreshQuestion` has no offline reason, so it cannot be put to
 * anyone.
 *
 * Pure apart from what it is handed: the network, the question, the wait and the
 * write all come in through `RefreshDeps`, which is what lets the whole decision tree run
 * under the plain node test environment.
 */

/** What a name search came back with, once read against the name asked for. */
export type Identification =
  | { kind: 'found'; match: TttmPlayer }
  /** `exact`: they all share the name. Otherwise they only come close to it. */
  | { kind: 'ambiguous'; candidates: TttmPlayer[]; exact: boolean }
  | { kind: 'none' }

/**
 * Who, out of a search's results, the roster's `name` is.
 *
 * Near matches are the players `rankMatches` puts in its second tier — every word of
 * the name somewhere in theirs — and they are offered only for a name of two words
 * or more. A single word is a first name or a nickname, and the search for it comes
 * back with half the league.
 */
export function identify(name: string, found: readonly TttmPlayer[]): Identification {
  const target = nameKey(name)
  const ranked = rankMatches(found, name)

  const exact = ranked.filter((player) => nameKey(player.name) === target)
  if (exact.length === 1) return { kind: 'found', match: exact[0] }
  if (exact.length > 1) return { kind: 'ambiguous', candidates: exact, exact: true }

  const words = target.split(' ').filter(Boolean)
  if (words.length < 2) return { kind: 'none' }
  const near = ranked.filter((player) => {
    const key = nameKey(player.name)
    return words.every((word) => key.includes(word))
  })
  return near.length > 0 ? { kind: 'ambiguous', candidates: near, exact: false } : { kind: 'none' }
}

/** Where the run needs a person, and the player it is about. */
export type RefreshQuestion =
  | { kind: 'choose'; player: Player; candidates: TttmPlayer[]; exact: boolean }
  | { kind: 'failed'; player: Player; reason: 'busy' | 'unreachable' }

/** `retry` answers only a failure; a choice is a pick, a skip or a stop. */
export type RefreshAnswer =
  { kind: 'pick'; match: TttmPlayer } | { kind: 'retry' } | { kind: 'skip' } | { kind: 'stop' }

/** What became of one player. */
export interface RefreshOutcome {
  playerId: string
  name: string
  kind: 'updated' | 'unchanged' | 'notFound' | 'skipped'
  /** The rank on the record before the run, when there was one. */
  before?: number
  /** The rank TTTM gave, for `updated` and `unchanged`. */
  after?: number
}

export interface RefreshDeps {
  /** Read a linked player straight off their page. */
  byId: (tttmId: number) => Promise<TttmResult<TttmPlayer>>
  search: (name: string) => Promise<TttmResult<TttmPlayer[]>>
  /** Put a question to the manager and wait for the answer. */
  ask: (question: RefreshQuestion) => Promise<RefreshAnswer>
  /** Settle once the device has a network again — or once the run is stopped. */
  waitForConnection: () => Promise<void>
  /** Write the rank, and link the player to the TTTM record it came from. */
  apply: (player: Player, match: TttmPlayer) => Promise<void>
  /** Told as each player is started, with how many came before them. */
  onStart?: (player: Player, index: number) => void
  onOutcome?: (outcome: RefreshOutcome) => void
  /** Checked after every wait: true ends the run where it stands. */
  stopped: () => boolean
}

type Step =
  | { kind: 'found'; match: TttmPlayer }
  | { kind: 'ambiguous'; candidates: TttmPlayer[]; exact: boolean }
  | { kind: 'none' }
  | { kind: 'failed'; reason: 'busy' | 'unreachable' }
  | { kind: 'offline' }

async function locate(player: Player, deps: RefreshDeps): Promise<Step> {
  if (player.tttmId !== undefined) {
    const own = await deps.byId(player.tttmId)
    if (own.kind === 'ok') return { kind: 'found', match: own.value }
    if (own.kind === 'offline') return { kind: 'offline' }
    if (own.kind !== 'none') return { kind: 'failed', reason: own.kind }
    // The stored id no longer reads as a player — renumbered, or the page changed
    // shape. Fall back to the name, the way a player who was never linked is found.
  }
  const found = await deps.search(player.name)
  if (found.kind === 'ok') return identify(player.name, found.value)
  if (found.kind === 'none') return { kind: 'none' }
  if (found.kind === 'offline') return { kind: 'offline' }
  return { kind: 'failed', reason: found.kind }
}

/** One player, start to finish; `'stop'` when the manager or the caller ended the run. */
async function refreshOne(player: Player, deps: RefreshDeps): Promise<RefreshOutcome | 'stop'> {
  const outcome = (kind: RefreshOutcome['kind'], after?: number): RefreshOutcome => ({
    playerId: player.id,
    name: player.name,
    kind,
    before: player.rank,
    after,
  })
  const take = async (match: TttmPlayer): Promise<RefreshOutcome> => {
    await deps.apply(player, match)
    return outcome(match.rank === player.rank ? 'unchanged' : 'updated', match.rank)
  }

  for (;;) {
    const step = await locate(player, deps)
    if (deps.stopped()) return 'stop'

    if (step.kind === 'found') return take(step.match)
    if (step.kind === 'none') return outcome('notFound')
    if (step.kind === 'offline') {
      await deps.waitForConnection()
      if (deps.stopped()) return 'stop'
      continue // the same player again, and nobody asked
    }

    const answer = await deps.ask(
      step.kind === 'ambiguous'
        ? { kind: 'choose', player, candidates: step.candidates, exact: step.exact }
        : { kind: 'failed', player, reason: step.reason },
    )
    if (answer.kind === 'stop' || deps.stopped()) return 'stop'
    if (answer.kind === 'skip') return outcome('skipped')
    if (answer.kind === 'pick') return take(answer.match)
    // retry: round the loop and ask TTTM again.
  }
}

/**
 * Refresh `players` one at a time, in the order given.
 *
 * One at a time is not caution, it is the relay's allowance: requests in parallel
 * would only queue behind it, and the questions have to come one at a time anyway.
 */
export async function refreshRanks(
  players: readonly Player[],
  deps: RefreshDeps,
): Promise<'done' | 'stopped'> {
  for (const [index, player] of players.entries()) {
    if (deps.stopped()) return 'stopped'
    deps.onStart?.(player, index)
    const outcome = await refreshOne(player, deps)
    if (outcome === 'stop') return 'stopped'
    deps.onOutcome?.(outcome)
  }
  return 'done'
}
