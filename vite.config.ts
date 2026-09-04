import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Relative base rather than a hard-coded '/<repo>/'. Hash routing means the document
// path never changes, so relative asset URLs always resolve — which lets a fork under
// any repo name, or a custom domain, work with no config change.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
