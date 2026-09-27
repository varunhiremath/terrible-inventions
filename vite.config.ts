import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Relative by default, so a build works opened from anywhere. GitHub Pages
// serves from a subdirectory and the service worker's scope has to match it, so
// CI sets BASE_PATH explicitly.
const BASE = process.env.BASE_PATH ?? './'

/**
 * Which build this is.
 *
 * Shown in the settings, so "have you got the new one?" has an answer that is
 * not a guess. It also guarantees that every build differs from the last by at
 * least one string, which is what makes the service worker notice one at all:
 * a change that minifies away leaves the bundle byte-identical, the precache
 * manifest identical, and the app correctly concludes there is nothing new.
 */
const BUILD = process.env.BUILD_ID ?? new Date().toISOString().slice(0, 16).replace('T', ' ')

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  // Relative by default, so the build works opened from anywhere. GitHub Pages
  // serves from a subdirectory and the service worker's scope has to match it,
  // so CI sets BASE_PATH explicitly.
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      /*
       * Prompt rather than autoUpdate, and the difference matters.
       *
       * autoUpdate reloads the page the moment a new service worker takes
       * over, which on a phone means the app can vanish and come back in the
       * middle of a race. src/update.ts does the deciding instead: it checks
       * far more often than the default, and it only takes the new version
       * when nothing is in progress.
       */
      registerType: 'prompt',
      includeAssets: ['icon-180.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Terrible Inventions',
        short_name: 'Inventions',
        description: 'Papa builds terrible machines. Somebody has to fix them.',
        theme_color: '#14161f',
        background_color: '#14161f',
        display: 'standalone',
        orientation: 'any',
        // Spelled out rather than left relative: iOS has been unreliable about
        // resolving a relative start_url, and getting it wrong means the
        // home-screen icon opens a blank page.
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The spoken clips go in too: 1.5 MB, and the voice is the thing you
        // most notice missing on a bad connection.
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}', 'spoken/*.opus', 'spoken/index.json'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
