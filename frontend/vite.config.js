import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Laravel dev server (php artisan serve). Override with BACKEND_URL if needed.
const backend = process.env.BACKEND_URL || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: true, // reachable from phones on the LAN during development
    port: 5173,
    proxy: {
      // changeOrigin stays false so Laravel sees the browser's Host → Sanctum treats it as same-origin.
      '/api': { target: backend },
      '/sanctum': { target: backend },
    },
  },
  build: {
    // Production: the SPA lives inside Laravel's public folder → one origin served by Apache.
    outDir: '../backend/public',
    emptyOutDir: false, // never wipe Laravel's index.php / .htaccess
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1500,
  },
})
