/**
 * Turn a chosen image into something safe to keep in IndexedDB.
 *
 * A photo straight off a phone camera is several megabytes, and the roster is read
 * in full on every launch — a dozen untouched photos would make the app start
 * slowly and could push the origin past its storage quota, which fails the *whole*
 * database, not just the picture. So every image is squared off, scaled to a
 * thumbnail and re-encoded as JPEG before it is stored: a few kilobytes each, which
 * is all a 96px avatar can show anyway.
 */
const MAX_EDGE = 320
const QUALITY = 0.82

export async function readPhoto(file: File, maxEdge = MAX_EDGE): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    // Centre crop to a square first, so faces are not stretched by the avatar's
    // border-radius and every roster row lines up.
    const edge = Math.min(bitmap.width, bitmap.height)
    const sx = (bitmap.width - edge) / 2
    const sy = (bitmap.height - edge) / 2
    const size = Math.min(edge, maxEdge)

    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('no 2d context')
    context.drawImage(bitmap, sx, sy, edge, edge, 0, 0, size, size)
    return canvas.toDataURL('image/jpeg', QUALITY)
  } finally {
    bitmap.close()
  }
}
