/*
 * src/assets/logo.jpg (the 588px club emblem master, not shipped) -> public/og.jpg,
 * the 1200x630 card every share link renders as.
 *
 *   node scripts/make-og.mjs        # needs ffmpeg on PATH
 *
 * The card carries no text. Not for want of trying: ffmpeg's drawtext does no bidi
 * reordering, so a Hebrew string comes out reversed unless it is pre-flipped by hand
 * against a font that happens to be on the machine — a recipe that would silently
 * produce a wrong-looking card on the next person's laptop. og:title supplies the
 * words in every place this image appears, and the emblem already spells the club's
 * name inside the ring, so the image only has to look like the app.
 *
 * Which is exactly what it is made of: the ground is --color-court-950 and the doodle
 * layer is --color-court-400 at the dark theme's own opacity, tiled at the same 620px
 * as index.css. Change the ramp or the wallpaper and regenerate rather than hand-edit,
 * the same arrangement as scripts/make-logo.mjs.
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))

/* The emblem is drawn a couple of pixels off-centre, so the disc is cut on the ring
   itself. Same measurement as make-logo.mjs — see the scan in the commit that added
   it: centre (293.5, 293.7), the ring's outer edge at r = 289. */
const CX = 293.5
const CY = 293.7
const R = 289
const FEATHER = 1.2 // px of alpha ramp, enough to anti-alias the cut

const GROUND = '0x041531' // --color-court-950
const INK = [51, 159, 238] // --color-court-400
const INK_OPACITY = 0.1 // the dark theme's 0.09, a hair up for a JPEG
const TILE = 620 // mask-size in index.css
const DISC = 400 // the emblem's diameter on the card

/* tile= pulls its cells off the stream one frame at a time, and a still image is one
   frame — hence loop=, without which three of the four cells come out black. */
const filter = [
  `[1:v]format=rgba,scale=${TILE}:${TILE}:flags=lanczos,`,
  `geq=r=${INK[0]}:g=${INK[1]}:b=${INK[2]}:a='alpha(X,Y)*${INK_OPACITY}',`,
  `loop=loop=3:size=1,tile=2x2,crop=1200:630:0:0[dood];`,
  `[0:v][dood]overlay=0:0[bg];`,
  `[2:v]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':`,
  `a='255*clip((${R}-hypot(X-${CX},Y-${CY}))/${FEATHER}+0.5,0,1)',`,
  `scale=${DISC}:${DISC}:flags=lanczos[logo];`,
  `[bg][logo]overlay=(W-w)/2:(H-h)/2,format=yuvj420p`,
].join('')

execFileSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=${GROUND}:s=1200x630`,
    '-i',
    `${root}src/assets/doodles.webp`,
    '-i',
    `${root}src/assets/logo.jpg`,
    '-filter_complex',
    filter,
    '-frames:v',
    '1',
    '-q:v',
    '3',
    `${root}public/og.jpg`,
  ],
  { stdio: 'inherit' },
)

console.log('wrote public/og.jpg')
