import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The relay's allowance and the cache, against a stubbed fetch.
 *
 * Both are module state, so each test imports a fresh copy of the module: what one
 * test spent of the allowance must not be what the next one starts with.
 */
const CARD = `<div class="playerPresentation">
  <div class="playerName">עמית גורן</div>
  <div>נקודות : 1747.6</div><div>ID של השחקן : 676</div>
</div>`

let fetched: string[]

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  fetched = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      fetched.push(url)
      return new Response(CARD, { status: 200 })
    }),
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('the relay allowance', () => {
  it('lets eighteen requests through at once and holds the nineteenth for the window', async () => {
    const { fetchTttmPlayer, relayFreeAt } = await import('./lookup')
    for (let id = 1; id <= 18; id++) await fetchTttmPlayer(String(id))
    expect(fetched).toHaveLength(18)
    expect(relayFreeAt()).toBeGreaterThan(Date.now())

    const held = fetchTttmPlayer('19')
    await vi.advanceTimersByTimeAsync(59_000)
    expect(fetched).toHaveLength(18)

    await vi.advanceTimersByTimeAsync(1_000)
    expect((await held).kind).toBe('ok')
    expect(fetched).toHaveLength(19)
  })

  it('spends nothing on an answer that is already cached', async () => {
    const { fetchTttmPlayer, relayFreeAt } = await import('./lookup')
    for (let i = 0; i < 30; i++) await fetchTttmPlayer('676')
    expect(fetched).toHaveLength(1)
    expect(relayFreeAt()).toBe(Date.now())
  })
})

describe('freshSince', () => {
  it('refetches what was cached before it, and shares what was fetched after', async () => {
    const { fetchTttmPlayer } = await import('./lookup')
    await fetchTttmPlayer('676')

    vi.advanceTimersByTime(1_000)
    const since = Date.now()
    const fresh = await fetchTttmPlayer('676', { freshSince: since })
    await fetchTttmPlayer('676', { freshSince: since })

    expect(fresh).toEqual({ kind: 'ok', value: { tttmId: 676, name: 'עמית גורן', rank: 1747.6 } })
    expect(fetched).toHaveLength(2)
  })
})
