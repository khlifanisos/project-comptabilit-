import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND = 'http://127.0.0.1:8080'

export default defineConfig({
  plugins: [react()],
  // pdfjs-dist@4 uses top-level await internally — needs a modern build target.
  build: {
    target: 'esnext',
  },
  esbuild: {
    target: 'esnext',
  },
  optimizeDeps: {
    esbuildOptions: { target: 'esnext' },
  },
  server: {
    port: 3000,
    // Dev server forwards backend paths to the Docker stack (`docker compose up -d` → port 8080).
    // To use a local `php artisan serve` instead, change BACKEND to http://127.0.0.1:8000.
    proxy: {
      '/api':     { target: BACKEND, changeOrigin: true },
      '/sanctum': { target: BACKEND, changeOrigin: true },
      '/storage': { target: BACKEND, changeOrigin: true },
      '/uploads': { target: BACKEND, changeOrigin: true },
    },
  },
})
