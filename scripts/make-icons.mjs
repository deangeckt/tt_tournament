/*
 * src/assets/logo.jpg (the 588px club emblem master, not shipped) -> the icons an
 * installed app is launched from, all in public/:
 *
 *   icon-192.png, icon-512.png   the disc on transparency — the manifest's `any`
 *   icon-maskable-512.png        the disc on the dark ground, inside the safe zone
 *   apple-touch-icon.png         180px, the same composition, for iOS
 *
 *   node scripts/make-icons.mjs        # needs ffmpeg on PATH
 *
 * Same disc as the header mark — cut on the emblem's own ring, paper flattened to
 * pure white, premultiplied area resample — so see scripts/make-logo.mjs for why each
 * of those. What differs is what sits behind it.
 *
 * A launcher that masks icons (Android's circles, squircles and teardrops) crops to
 * the middle 80% of a `maskable` icon, and fills nothing in: a transparent corner
 * comes out as whatever the launcher likes. So the maskable icon is an opaque square
 * of --color-court-950, the dark theme's ground, with the disc at 78% — inside the
 * safe zone with a hair to spare. iOS ignores the manifest altogether and fills any
 * transparency in apple-touch-icon with black, so that one is opaque for the same
 * reason.
 *
 * None of these is precached. They are fetched once, at install, and the emblem's
 * shaded portrait does not compress losslessly — the 512s are a few hundred KB each,
 * which a precache would add to every first visit for an install most visitors never
 * make.
 *
 * Launchers and iOS cache an icon by url and keep it through reinstalls — the same
 * trap as racket.svg in index.html. Changing the emblem means changing these
 * filenames too, not only regenerating them.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const SRC = 588 // the master's dimensions, square

/* Same measurement as make-logo.mjs — see the scan in the commit that added it:
   centre (293.5, 293.7), the ring's outer edge at r = 289. */
const CX = 293.5
const CY = 293.7
const R = 289
const FEATHER = 1.2 // px of alpha ramp, enough to anti-alias the cut

/* Luma above HI is paper and becomes pure white; below LO is ink. As make-logo.mjs. */
const LO = 226
const HI = 246

const GROUND = [4, 21, 49] // --color-court-950, #041531

const tmp = mkdtempSync(join(tmpdir(), 'tt-icons-'))
const raw = join(tmp, 'logo.raw')
execFileSync('ffmpeg', ['-v', 'error', '-i', join(root, 'src/assets/logo.jpg'),
  '-f', 'rawvideo', '-pix_fmt', 'rgb24', raw, '-y'])

// Flatten the paper and cut the circle at full resolution, premultiplied so the
// resample cannot bleed the (white) outside into the ring's dark edge.
const src = readFileSync(raw)
const rgb = new Float64Array(SRC * SRC * 3)
const alpha = new Float64Array(SRC * SRC)
for (let y = 0; y < SRC; y++) {
  for (let x = 0; x < SRC; x++) {
    const i = (y * SRC + x) * 3
    let [r, g, b] = [src[i], src[i + 1], src[i + 2]]
    const luma = 0.299 * r + 0.587 * g + 0.114 * b
    if (luma > LO) {
      const k = Math.min(1, (luma - LO) / (HI - LO))
      r += (255 - r) * k
      g += (255 - g) * k
      b += (255 - b) * k
    }
    const d = Math.hypot(x + 0.5 - CX, y + 0.5 - CY)
    const a = Math.max(0, Math.min(1, (R - d) / FEATHER + 0.5))
    alpha[y * SRC + x] = a
    rgb[i] = r * a
    rgb[i + 1] = g * a
    rgb[i + 2] = b * a
  }
}

/** The disc at `size` px: premultiplied rgb and alpha, area-resampled from the master. */
function disc(size) {
  const out = { rgb: new Float64Array(size * size * 3), alpha: new Float64Array(size * size) }
  const step = SRC / size
  for (let oy = 0; oy < size; oy++) {
    for (let ox = 0; ox < size; ox++) {
      const x0 = ox * step
      const x1 = x0 + step
      const y0 = oy * step
      const y1 = y0 + step
      let sr = 0
      let sg = 0
      let sb = 0
      let sa = 0
      let sw = 0
      for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0)
        for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
          const w = wy * (Math.min(x + 1, x1) - Math.max(x, x0))
          const i = (y * SRC + x) * 3
          sr += rgb[i] * w
          sg += rgb[i + 1] * w
          sb += rgb[i + 2] * w
          sa += alpha[y * SRC + x] * w
          sw += w
        }
      }
      const o = oy * size + ox
      out.rgb[o * 3] = sr / sw
      out.rgb[o * 3 + 1] = sg / sw
      out.rgb[o * 3 + 2] = sb / sw
      out.alpha[o] = sa / sw
    }
  }
  return out
}

/**
 * A `canvas`-px square PNG with a `size`-px disc in the middle, over `ground` — or
 * over transparency when there is none.
 */
function icon(file, canvas, size, ground) {
  const d = disc(size)
  const offset = (canvas - size) / 2
  const out = Buffer.alloc(canvas * canvas * 4)
  for (let y = 0; y < canvas; y++) {
    for (let x = 0; x < canvas; x++) {
      const dx = x - offset
      const dy = y - offset
      const inside = dx >= 0 && dy >= 0 && dx < size && dy < size
      const i = inside ? dy * size + dx : -1
      const a = inside ? d.alpha[i] : 0
      const o = (y * canvas + x) * 4
      for (let c = 0; c < 3; c++) {
        const ink = inside ? d.rgb[i * 3 + c] : 0 // premultiplied
        if (ground) {
          out[o + c] = Math.round(Math.min(255, ink + ground[c] * (1 - a)))
        } else {
          // Fully transparent pixels are left white, as in make-logo.mjs: a launcher
          // resampling the icon then has nothing dark to pull in from outside.
          out[o + c] = a > 0 ? Math.round(Math.min(255, ink / a)) : 255
        }
      }
      out[o + 3] = ground ? 255 : Math.round(a * 255)
    }
  }
  const scaled = join(tmp, `${file}.rgba`)
  writeFileSync(scaled, out)
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba',
    '-s', `${canvas}x${canvas}`, '-i', scaled,
    '-pix_fmt', ground ? 'rgb24' : 'rgba', '-pred', 'mixed', '-compression_level', '9',
    join(root, 'public', file), '-y'])
  console.log(`wrote public/${file} (${canvas}px)`)
}

icon('icon-192.png', 192, 192)
icon('icon-512.png', 512, 512)
icon('icon-maskable-512.png', 512, 400, GROUND) // 400/512 = 78%, inside the 80% safe zone
icon('apple-touch-icon.png', 180, 140, GROUND)
