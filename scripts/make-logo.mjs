/*
 * src/assets/logo.jpg (the 588px club emblem, not shipped — nothing imports it)
 * -> src/assets/logo.webp, the header mark.
 *
 *   node scripts/make-logo.mjs        # needs ffmpeg on PATH
 *
 * Two things happen here, and both are about the white paper the emblem was drawn
 * on. The square corners are cut away on the emblem's own circle, so what lands in
 * the header is a disc bounded by the artwork's navy ring rather than a white box
 * that only looks right in light mode. And the paper itself is flattened to pure
 * white above a threshold: it arrived as JPEG-noisy off-white, which is invisible,
 * is most of the file, and is the worst case for any compressor. Same reasoning as
 * the doodle wallpaper in index.css.
 *
 * The paper is deliberately *kept* rather than made transparent. The emblem is
 * navy ink on white, so dropping the paper would leave the ink invisible against a
 * dark header, and masking it to a single colour would throw away the flag's blue.
 * A white disc on a dark ground reads as a badge, which is what it is.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const assets = fileURLToPath(new URL('../src/assets/', import.meta.url))
const SRC = 588 // the master's dimensions, square
const OUT = 192 // 4x the 40px the header draws it at, ~14KB encoded

/* The emblem is drawn a couple of pixels off-centre, so the circle is measured
   from the ring rather than assumed to be the canvas. See the scan in the commit
   that added this: centre (293.5, 293.7), the ring's outer edge at r = 289. */
const CX = 293.5
const CY = 293.7
const R = 289
const FEATHER = 1.2 // px of alpha ramp, enough to anti-alias the cut

/* Luma above HI is paper and becomes pure white; below LO is ink and is left
   alone. The ramp between them keeps the portrait's soft shading from stepping. */
const LO = 226
const HI = 246

const tmp = mkdtempSync(join(tmpdir(), 'tt-logo-'))
const raw = join(tmp, 'logo.raw')
const scaled = join(tmp, 'logo.bgra')

execFileSync('ffmpeg', ['-v', 'error', '-i', join(assets, 'logo.jpg'),
  '-f', 'rawvideo', '-pix_fmt', 'rgb24', raw, '-y'])

const src = readFileSync(raw)
// Flatten the paper and cut the circle at full resolution, premultiplied so the
// resample below cannot bleed the (white) outside into the ring's dark edge.
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

// Area resample. Box-averaging every source pixel that falls in the target pixel
// beats any of ffmpeg's kernels here: the artwork is line work on flat paper, and
// a sharpening kernel would ring along every stroke.
const out = Buffer.alloc(OUT * OUT * 4)
const step = SRC / OUT
for (let oy = 0; oy < OUT; oy++) {
  for (let ox = 0; ox < OUT; ox++) {
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
    const a = sa / sw
    const un = a > 0 ? 1 / (a * sw) : 0
    const o = (oy * OUT + ox) * 4
    // bgra is what libwebp takes. Fully transparent pixels are left white so that
    // a browser resampling the sprite has nothing dark to pull in from outside.
    out[o] = a > 0 ? Math.round(Math.min(255, sb * un)) : 255
    out[o + 1] = a > 0 ? Math.round(Math.min(255, sg * un)) : 255
    out[o + 2] = a > 0 ? Math.round(Math.min(255, sr * un)) : 255
    out[o + 3] = Math.round(a * 255)
  }
}
writeFileSync(scaled, out)

execFileSync('ffmpeg', ['-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgra',
  '-s', `${OUT}x${OUT}`, '-i', scaled, '-c:v', 'libwebp', '-pix_fmt', 'yuva420p',
  '-preset', 'picture', '-quality', '90', join(assets, 'logo.webp'), '-y'])

console.log(`wrote src/assets/logo.webp (${OUT}px)`)
