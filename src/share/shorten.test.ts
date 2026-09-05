import { afterEach, describe, expect, it, vi } from 'vitest'
import { SHORTENABLE_URL_LENGTH, shortenUrl } from './shorten'

const original = globalThis.fetch

afterEach(() => {
  globalThis.fetch = original
  vi.restoreAllMocks()
})

/** Each test uses its own long url, since successful shortenings are memoised. */
function longUrl(tag: string) {
  return `https://club.example/tt/#/v/${tag}`
}

describe('shortenUrl', () => {
  it('returns the first provider’s answer, upgrading its http link', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ short_url: 'http://spoo.me/abc123' }), { status: 200 }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    expect(await shortenUrl(longUrl('first'))).toBe('https://spoo.me/abc123')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('memoises, so the same link is never minted twice', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ short_url: 'https://spoo.me/same' }), { status: 200 }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const url = longUrl('memo')
    expect(await shortenUrl(url)).toBe('https://spoo.me/same')
    expect(await shortenUrl(url)).toBe('https://spoo.me/same')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls through to the next provider when one is down', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(new Response('https://clck.ru/xyz\n', { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    expect(await shortenUrl(longUrl('fallback'))).toBe('https://clck.ru/xyz')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns null when nothing answers, rather than throwing at the caller', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    expect(await shortenUrl(longUrl('offline'))).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects a body that is not a url, instead of copying an error page', async () => {
    const fetchMock = vi.fn(async () => new Response('Error: rate limited', { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    expect(await shortenUrl(longUrl('garbage'))).toBeNull()
  })

  it('does not call out at all for a payload no service would take', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    expect(await shortenUrl(longUrl('x'.repeat(SHORTENABLE_URL_LENGTH)))).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('skips a provider whose own limit the link exceeds', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    // clck.ru caps at 4096 and is the second provider, so only one call goes out.
    expect(await shortenUrl(longUrl('y'.repeat(4200)))).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
