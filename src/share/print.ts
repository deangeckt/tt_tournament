/**
 * Print the page the browser is already showing — the offline half of sharing.
 *
 * Two things have to be true on paper that are not true on screen, and neither can
 * be said in CSS.
 *
 * Dark mode is the first. The `dark:` variant keys off `<html data-theme>`, so a
 * club running the app dark would print pale grey on white — legible on a monitor,
 * invisible on a sheet. CSS cannot change an attribute, and the variant compiles
 * inside `:where(...)`, which contributes no specificity to override property by
 * property; flipping the attribute for the duration of the print is the one lever
 * that reaches all of it at once. `afterprint` puts it back, and the call after
 * `print()` covers the browsers that never fire it — every engine blocks there
 * until the dialog is dismissed.
 *
 * The second is timing: this is called from a sheet that has just been dismissed,
 * and the spring takes a few frames to finish. The sheet carries `no-print` so it
 * can no longer land in the printout either way, but its open-state effect is also
 * what restores `body { overflow }`, so the print waits for React to unmount it
 * rather than printing a page that is still locked against scrolling.
 */
export function printPage() {
  const root = document.documentElement
  const theme = root.getAttribute('data-theme')

  let restored = false
  const restore = () => {
    if (restored) return
    restored = true
    window.removeEventListener('afterprint', restore)
    if (theme) root.setAttribute('data-theme', theme)
    else root.removeAttribute('data-theme')
  }

  root.setAttribute('data-theme', 'light')
  window.addEventListener('afterprint', restore)

  // One frame for React to unmount the sheet, one for the layout it leaves behind.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      window.print()
      restore()
    }),
  )
}
