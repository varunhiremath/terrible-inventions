import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Relative by default, so a build works opened from anywhere. GitHub Pages
// serves from a subdirectory and the service worker's scope has to match it, so
// CI sets BASE_PATH explicitly.
const BASE = process.env.BASE_PATH ?? './'

export default defineConfig({
  // Relative by default, so the build works opened from anywhere. GitHub Pages
  // serves from a subdirectory and the service worker's scope has to match it,
  // so CI sets BASE_PATH explicitly.
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
