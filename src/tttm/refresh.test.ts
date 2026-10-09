import { describe, expect, it } from 'vitest'
import type { Player } from '../engine/types'
import type { TttmResult } from './lookup'
import type { TttmPlayer } from './parse'
import {
  identify,
  refreshRanks,
  type RefreshAnswer,
  type RefreshDeps,
  type RefreshOutcome,
  type RefreshQuestion,
} from './refresh'

const tttm = (tttmId: number, name: string, rank: number): TttmPlayer => ({ tttmId, name, rank })

// The pair the parser's fixtures are built around: two people called עמית גורן.
const gorenRanked = tttm(676, 'עמית גורן', 1747.6)
const gorenUnranked = tttm(2682, 'עמית גורן', 0)
const ronitGoren = tttm(812, 'רונית גורן', 1302.4)

describe('identify', () => {
  it('takes the one player of exactly that name', () => {
    expect(identify('רונית גורן', [gorenRanked, ronitGoren])).toEqual({
      kind: 'found',
      match: ronitGoren,
    })
  })

  it('ignores case and stray whitespace, as a person would', () => {
    const found = identify('  Ronit   GOREN ', [tttm(9, 'Ronit Goren', 10)])
    expect(found.kind).toBe('found')
  })

  it('asks between namesakes rather than guessing, the ranked one first', () => {
    const found = identify('עמית גורן', [gorenUnranked, ronitGoren, gorenRanked])
    expect(found).toEqual({
      kind: 'ambiguous',
      candidates: [gorenRanked, gorenUnranked],
      exact: true,
    })
  })

  it('offers a near spelling as a question, never as an answer', () => {
    const daniel = tttm(31, 'דניאל כהן', 1500)
    expect(identify('דני כהן', [tttm(30, 'משה כהן', 900), daniel])).toEqual({
      kind: 'ambiguous',
      candidates: [daniel],
      exact: false,
    })
  })

  it('does not offer near matches for a single word', () => {
    expect(identify('דני', [tttm(31, 'דניאל כהן', 1500)])).toEqual({ kind: 'none' })
  })

  it('finds nobody in a family that only shares the surname', () => {
    expect(identify('יוסי גורן', [gorenRanked, ronitGoren])).toEqual({ kind: 'none' })
  })
})

const player = (id: string, name: string, extra: Partial<Player> = {}): Player => ({
  id,
  name,
  ...extra,
})

/**
 * A run against scripted answers: `byId` and `search` replay a queue per key, and
 * `answers` is what the manager taps, in order. Everything the run does is logged,
 * waiting for a connection included; `whileWaiting` runs during each wait.
 */
function harness({
  byId = {},
  search = {},
  answers = [],
  whileWaiting,
}: {
  byId?: Record<number, TttmResult<TttmPlayer>[]>
  search?: Record<string, TttmResult<TttmPlayer[]>[]>
  answers?: RefreshAnswer[]
  whileWaiting?: () => void
}) {
  const calls: string[] = []
  const questions: RefreshQuestion[] = []
  const applied: [string, number][] = []
  const outcomes: RefreshOutcome[] = []
  let stop = false

  const deps: RefreshDeps = {
    byId: async (id) => {
      calls.push(`id:${id}`)
      return byId[id]?.shift() ?? { kind: 'none' }
    },
    search: async (name) => {
      calls.push(`search:${name}`)
      return search[name]?.shift() ?? { kind: 'none' }
    },
    ask: async (question) => {
      questions.push(question)
      const answer = answers.shift() ?? { kind: 'stop' }
      if (answer.kind === 'stop') stop = true
      return answer
    },
    waitForConnection: async () => {
      calls.push('wait')
      whileWaiting?.()
    },
    apply: async (p, match) => {
      applied.push([p.id, match.rank])
    },
    onOutcome: (outcome) => outcomes.push(outcome),
    stopped: () => stop,
  }
  return { deps, calls, questions, applied, outcomes, stopNow: () => (stop = true) }
}

describe('refreshRanks', () => {
  it('reads a linked player off their own page and never searches for them', async () => {
    const h = harness({ byId: { 676: [{ kind: 'ok', value: gorenRanked }] } })
    const result = await refreshRanks(
      [player('a', 'עמית גורן', { tttmId: 676, rank: 1700 })],
      h.deps,
    )

    expect(result).toBe('done')
    expect(h.calls).toEqual(['id:676'])
    expect(h.questions).toEqual([])
    expect(h.outcomes).toEqual([
      { playerId: 'a', name: 'עמית גורן', kind: 'updated', before: 1700, after: 1747.6 },
    ])
  })

  it('always fetches, and says so when the rank has not moved', async () => {
    const h = harness({ search: { 'רונית גורן': [{ kind: 'ok', value: [ronitGoren] }] } })
    await refreshRanks([player('r', 'רונית גורן', { rank: 1302.4 })], h.deps)

    expect(h.applied).toEqual([['r', 1302.4]])
    expect(h.outcomes[0].kind).toBe('unchanged')
  })

  it('falls back to the name when a stored id stops reading as a player', async () => {
    const h = harness({
      byId: { 99: [{ kind: 'none' }] },
      search: { 'רונית גורן': [{ kind: 'ok', value: [ronitGoren] }] },
    })
    await refreshRanks([player('r', 'רונית גורן', { tttmId: 99 })], h.deps)

    expect(h.calls).toEqual(['id:99', 'search:רונית גורן'])
    expect(h.applied).toEqual([['r', 1302.4]])
  })

  it('stops to ask between namesakes, and applies the one picked', async () => {
    const h = harness({
      search: { 'עמית גורן': [{ kind: 'ok', value: [gorenUnranked, gorenRanked] }] },
      answers: [{ kind: 'pick', match: gorenUnranked }],
    })
    const result = await refreshRanks([player('a', 'עמית גורן')], h.deps)

    expect(result).toBe('done')
    expect(h.questions).toHaveLength(1)
    expect(h.questions[0]).toMatchObject({ kind: 'choose', exact: true })
    expect(h.applied).toEqual([['a', 0]])
    // Absent is not zero: a first rank is a change even when it is 0.0.
    expect(h.outcomes[0]).toMatchObject({ kind: 'updated', after: 0 })
  })

  it('records a skipped player and carries on with the next', async () => {
    const h = harness({
      search: {
        'עמית גורן': [{ kind: 'ok', value: [gorenUnranked, gorenRanked] }],
        'רונית גורן': [{ kind: 'ok', value: [ronitGoren] }],
      },
      answers: [{ kind: 'skip' }],
    })
    await refreshRanks([player('a', 'עמית גורן'), player('r', 'רונית גורן')], h.deps)

    expect(h.outcomes.map((o) => o.kind)).toEqual(['skipped', 'updated'])
    expect(h.applied).toEqual([['r', 1302.4]])
  })

  it('reports nobody found without stopping to ask', async () => {
    const h = harness({ search: { 'יוסי לוי': [{ kind: 'none' }] } })
    await refreshRanks([player('y', 'יוסי לוי', { rank: 500 })], h.deps)

    expect(h.questions).toEqual([])
    expect(h.applied).toEqual([])
    expect(h.outcomes).toEqual([
      { playerId: 'y', name: 'יוסי לוי', kind: 'notFound', before: 500, after: undefined },
    ])
  })

  it('asks on a failure, and a retry asks TTTM again', async () => {
    const h = harness({
      search: {
        'רונית גורן': [{ kind: 'unreachable' }, { kind: 'ok', value: [ronitGoren] }],
      },
      answers: [{ kind: 'retry' }],
    })
    await refreshRanks([player('r', 'רונית גורן')], h.deps)

    expect(h.questions).toEqual([
      { kind: 'failed', player: player('r', 'רונית גורן'), reason: 'unreachable' },
    ])
    expect(h.calls).toEqual(['search:רונית גורן', 'search:רונית גורן'])
    expect(h.outcomes[0].kind).toBe('updated')
  })

  it('treats a failed linked lookup as a failure, not as a reason to search', async () => {
    const h = harness({ byId: { 676: [{ kind: 'busy' }] }, answers: [{ kind: 'skip' }] })
    await refreshRanks([player('a', 'עמית גורן', { tttmId: 676 })], h.deps)

    expect(h.calls).toEqual(['id:676'])
    expect(h.questions[0]).toMatchObject({ kind: 'failed', reason: 'busy' })
  })

  it('ends the run where a stop is answered, touching nobody after it', async () => {
    const h = harness({
      search: {
        'רונית גורן': [{ kind: 'unreachable' }],
        'עמית גורן': [{ kind: 'ok', value: [gorenRanked] }],
      },
      answers: [{ kind: 'stop' }],
    })
    const result = await refreshRanks([player('r', 'רונית גורן'), player('a', 'עמית גורן')], h.deps)

    expect(result).toBe('stopped')
    expect(h.outcomes).toEqual([])
    expect(h.calls).toEqual(['search:רונית גורן'])
  })

  it('waits out a lost connection without asking, then carries on with the same player', async () => {
    const h = harness({
      search: { 'רונית גורן': [{ kind: 'offline' }, { kind: 'ok', value: [ronitGoren] }] },
    })
    const result = await refreshRanks([player('r', 'רונית גורן')], h.deps)

    expect(result).toBe('done')
    expect(h.questions).toEqual([])
    expect(h.calls).toEqual(['search:רונית גורן', 'wait', 'search:רונית גורן'])
    expect(h.outcomes[0].kind).toBe('updated')
  })

  it('waits the same way for a linked player read off their page', async () => {
    const h = harness({
      byId: { 676: [{ kind: 'offline' }, { kind: 'ok', value: gorenRanked }] },
    })
    await refreshRanks([player('a', 'עמית גורן', { tttmId: 676 })], h.deps)

    expect(h.questions).toEqual([])
    expect(h.calls).toEqual(['id:676', 'wait', 'id:676'])
    expect(h.applied).toEqual([['a', 1747.6]])
  })

  it('ends the run when it is stopped while waiting for a connection', async () => {
    const h = harness({
      search: {
        'רונית גורן': [{ kind: 'offline' }],
        'עמית גורן': [{ kind: 'ok', value: [gorenRanked] }],
      },
      whileWaiting: () => h.stopNow(),
    })
    const result = await refreshRanks([player('r', 'רונית גורן'), player('a', 'עמית גורן')], h.deps)

    expect(result).toBe('stopped')
    expect(h.outcomes).toEqual([])
    expect(h.calls).toEqual(['search:רונית גורן', 'wait'])
  })

  it('drops a lookup that comes back after the run was stopped', async () => {
    const h = harness({})
    h.deps.search = async () => {
      h.stopNow()
      return { kind: 'ok', value: [ronitGoren] }
    }
    const result = await refreshRanks([player('r', 'רונית גורן')], h.deps)

    expect(result).toBe('stopped')
    expect(h.applied).toEqual([])
  })
})
