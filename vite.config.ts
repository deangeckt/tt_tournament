import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Relative base rather than a hard-coded '/<repo>/'. Hash routing means the document
// path never changes, so relative asset URLs always resolve — which lets a fork under
// any repo name, or a custom domain, work with no config change.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    // The service worker that lets the app open with no connection, and the manifest
    // that lets it be installed. See "Working offline" in CLAUDE.md.
    VitePWA({
      // A new build waits for the manager to tap the toast src/pwa.ts raises: an
      // automatic reload would take a half-typed score with it.
      registerType: 'prompt',
      injectRegister: false,
      // Fetched once, at install; not worth a few hundred KB on every first visit.
      includeManifestIcons: false,
      manifest: {
        name: 'ניהול תחרויות טניס שולחן',
        short_name: 'טורנירים',
        description:
          'ארגון וניהול תחרות טניס שולחן (פינג פונג): הגרלה, בתים ונוק-אאוט, תוצאות וטבלאות דירוג חיות לפי חוקי ITTF.',
        lang: 'he',
        dir: 'rtl',
        // Relative to the manifest, for the same reason base is. No `id`: it would be
        // resolved against the *origin*, and every github.io project shares that one.
        // Left out, it defaults to start_url, which is ours alone.
        start_url: './',
        scope: './',
        display: 'standalone',
        // The dark theme's own colours — the meta store/theme.ts writes and the
        // ground of --color-court-950 — so the splash does not flash a third colour.
        theme_color: '#0d1526',
        background_color: '#041531',
        categories: ['sports'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // An allowlist rather than ignores. Every browser with a service worker reads
        // woff2, so the .woff fallbacks would only be dead weight; og.jpg is for link
        // previews, and robots, sitemap and the icons are never needed offline.
        globPatterns: ['**/*.{js,css,html,svg,webp,woff2}'],
        navigateFallback: 'index.html',
        // Otherwise a browser that has the app would answer /sitemap.xml with it.
        navigateFallbackDenylist: [/\.(?:xml|txt|jpg|png|webmanifest)$/],
        cleanupOutdatedCaches: true,
        // No runtime caching on purpose: a rank lookup or a shortener that cannot be
        // reached has to say so, not quietly answer with last week's response.
      },
      // A second cache in front of the dev server would compound the stale-transform
      // gotcha in CLAUDE.md. `npm run preview` is where the worker is tried.
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
