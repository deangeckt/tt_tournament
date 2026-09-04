/**
 * Deterministic seeded randomness.
 *
 * Every draw is generated from a stored string seed, which means the draw can be
 * replayed exactly: the whole tournament stays reproducible from
 * { players, config, seed }, share links stay tiny, and a manager can prove to a
 * player that the draw was not rigged.
 */

export type Rng = () => number

/** Small, fast PRNG with good distribution for our purposes. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a: string seed -> uint32, so seeds can be human-readable. */
export function hashSeed(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

export function rngFromSeed(seed: string): Rng {
  return mulberry32(hashSeed(seed))
}

/** Fisher-Yates. Returns a new array; does not mutate the input. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Human-readable, unambiguous seed the manager can write on a whiteboard. */
export function generateSeed(random: Rng = Math.random): string {
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += SEED_ALPHABET[Math.floor(random() * SEED_ALPHABET.length)]
  }
  return out
}
