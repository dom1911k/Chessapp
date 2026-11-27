import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// VITE_PWA=1 builds the web app (GitHub Pages, iPhone "Add to Home Screen") with an
// offline service worker. The Android build leaves it out: there the APK updater
// handles updates and a service worker would only serve stale files.
const pwa = process.env.VITE_PWA === '1';

export default defineConfig({
  // VITE_CACHE_DIR: a second dev server (the screenshot harness in a git worktree that shares
  // node_modules) keeps its own pre-bundled deps instead of rebuilding this one's.
  ...(process.env.VITE_CACHE_DIR ? { cacheDir: process.env.VITE_CACHE_DIR } : {}),
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      disable: !pwa,
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Chess Coach',
        short_name: 'Chess Coach',
        description: 'A patient, beginner-friendly chess coach that works offline.',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#312e2b',
        background_color: '#312e2b',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything — app, engine and puzzles — so it works fully offline.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm,json,bin,mp3}'],
        // The largest is onnxruntime's wasm for Maia-3 (14.8 MB).
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // Relative asset paths so the bundle works from Capacitor's local server and from GitHub Pages.
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
