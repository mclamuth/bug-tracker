/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The API runs on http://localhost:5011 during development (see src/BugTracker.Api/Properties/launchSettings.json).
const apiTarget = process.env.API_URL ?? 'http://localhost:5011'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Lets a VS Code port-forwarding tunnel (https://<id>-5173.<region>.devtunnels.ms) reach the dev server,
    // so the app can be shown to someone else while it runs here (README: "Showing it to someone else").
    allowedHosts: ['.devtunnels.ms'],
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Fluent UI is one large chunk by design; MSAL is split out and loaded only for Microsoft sign-in.
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
